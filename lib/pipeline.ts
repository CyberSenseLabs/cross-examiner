import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audits, claims, probes, dimensionScores } from "@/db/schema";
import { getModel } from "./providers";
import { decomposeClaims } from "./decompose";
import { adjudicate } from "./adjudicate";
import { computeScore, computeCalibration } from "./score";
import { runRestatement } from "./probes/restatement";
import { runAtomicClaim } from "./probes/atomicClaim";
import { runContradictionTrap } from "./probes/contradictionTrap";
import { runSpecificity } from "./probes/specificity";
import { runProvenance } from "./probes/provenance";
import { runBoundary } from "./probes/boundary";
import { runCounterfactual } from "./probes/counterfactual";
import { runSelfCritique } from "./probes/selfCritique";
import { runConfidence } from "./probes/confidence";
import { runGroundTruth } from "./probes/groundTruth";

const PROBE_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Probe timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export type PipelineInput = {
  originalPrompt: string;
  targetResponse?: string;
  targetModel: string;
  interrogatorModel: string;
  adjudicatorModel: string;
};

export async function createAudit(input: PipelineInput): Promise<string> {
  const [audit] = await db.insert(audits).values({
    originalPrompt: input.originalPrompt,
    targetResponse: input.targetResponse || "__pending__",
    targetModel: input.targetModel,
    interrogatorModel: input.interrogatorModel,
    adjudicatorModel: input.adjudicatorModel,
    status: "running",
  }).returning();
  return audit.id;
}

export async function runPipeline(auditId: string, input: PipelineInput): Promise<void> {
  const { originalPrompt, targetModel, interrogatorModel, adjudicatorModel } = input;

  try {
    let targetResponse = input.targetResponse ?? "";

    if (!targetResponse) {
      try {
        const { text } = await generateText({
          model: getModel(targetModel),
          messages: [{ role: "user", content: originalPrompt }],
        });
        targetResponse = text;
        await db.update(audits).set({ targetResponse }).where(eq(audits.id, auditId));
      } catch (err) {
        throw new Error(`Target model failed to generate a response: ${err}`);
      }
    }

    let rawClaims;
    try {
      rawClaims = await decomposeClaims(originalPrompt, targetResponse, interrogatorModel);
    } catch (err) {
      throw new Error(`Claim decomposition failed: ${err}`);
    }

    const insertedClaims = rawClaims.length > 0
      ? await db.insert(claims).values(
          rawClaims.map((c, i) => ({
            auditId,
            orderIndex: i,
            text: c.text,
            claimType: c.claimType,
          }))
        ).returning()
      : [];
    const factualClaims = insertedClaims.filter((c) => c.claimType === "factual");

    const confidenceMap = await runConfidence(
      factualClaims.map((c, i) => ({ text: c.text, index: i })),
      targetModel,
    ).catch(() => new Map<number, number>());

    for (let i = 0; i < factualClaims.length; i++) {
      const conf = confidenceMap.get(i);
      if (conf != null) {
        await db.update(claims)
          .set({ statedConfidence: conf })
          .where(eq(claims.id, factualClaims[i].id));
      }
    }

    async function probe(
      claimId: string | null,
      probeType: string,
      dimension: string,
      claimText: string,
      run: () => Promise<{ role: "user" | "assistant"; content: string; turn: number }[]>,
    ) {
      const [row] = await db.insert(probes).values({
        auditId, claimId, probeType, dimension,
      }).returning();

      try {
        const transcript = await withTimeout(run(), PROBE_TIMEOUT_MS);
        const { verdict, rationale } = await adjudicate(probeType, claimText, transcript, adjudicatorModel);
        await db.update(probes).set({ verdict: verdict as any, rationale, transcript }).where(eq(probes.id, row.id));
        return { dimension, verdict };
      } catch (err) {
        console.error(`[pipeline] probe ${probeType} failed:`, err);
        await db.update(probes).set({ verdict: "fail", rationale: String(err) }).where(eq(probes.id, row.id));
        return { dimension, verdict: "fail" };
      }
    }

    // Run all claims' batteries in parallel — each claim's 8 probes still run in parallel within it.
    const claimBatteryResults = await Promise.allSettled(
      factualClaims.map(async (claim) => {
        const claimText = claim.text;
        const cid = claim.id;

        const results = await Promise.allSettled([
          probe(cid, "restatement", "self_consistency", claimText,
            () => runRestatement(claimText, targetModel, interrogatorModel)),
          probe(cid, "atomic_claim", "self_consistency", claimText,
            () => runAtomicClaim(claimText, targetModel)),
          probe(cid, "contradiction_trap", "self_consistency", claimText,
            () => runContradictionTrap(claimText, targetModel, interrogatorModel)),
          probe(cid, "specificity", "specificity_integrity", claimText,
            () => runSpecificity(claimText, targetModel)),
          probe(cid, "provenance", "provenance", claimText,
            () => runProvenance(claimText, targetModel)),
          probe(cid, "boundary", "epistemic_honesty", claimText,
            () => runBoundary(claimText, targetModel, interrogatorModel)),
          probe(cid, "counterfactual", "conviction_robustness", claimText,
            () => runCounterfactual(claimText, targetModel, interrogatorModel)),
          probe(cid, "self_critique", "conviction_robustness", claimText,
            () => runSelfCritique(claimText, targetModel)),
        ]);

        return results
          .filter((r): r is PromiseFulfilledResult<{ dimension: string; verdict: string }> => r.status === "fulfilled")
          .map(r => r.value);
      })
    );

    const allVerdicts: { dimension: string; verdict: string }[] = [];
    for (const r of claimBatteryResults) {
      if (r.status === "fulfilled") allVerdicts.push(...r.value);
    }

    for (const claim of factualClaims) {
      const r = await probe(claim.id, "ground_truth", "ground_truth_factuality", claim.text,
        () => runGroundTruth(claim.text, interrogatorModel))
        .catch(() => ({ dimension: "ground_truth_factuality", verdict: "partial" }));
      allVerdicts.push(r);
    }

    const probeRows = await db.query.probes.findMany({ where: eq(probes.auditId, auditId) });
    for (const claim of factualClaims) {
      const cp = probeRows.filter((p) => p.claimId === claim.id);
      const hasFail = cp.some((p) => p.verdict === "fail" || p.verdict === "fabricated_source" || p.verdict === "confident_fabrication");
      const hasPass = cp.some((p) => p.verdict === "pass");
      const survived = hasFail ? 0 : hasPass ? 1 : 0.5;
      await db.update(claims).set({ survived }).where(eq(claims.id, claim.id));
    }

    const { composite, dimResults, verdict } = computeScore(allVerdicts);
    const allClaims = await db.query.claims.findMany({ where: eq(claims.auditId, auditId) });
    const { delta, direction } = computeCalibration(allClaims);

    await db.insert(dimensionScores).values(dimResults.map((d) => ({ auditId, ...d })));

    await db.update(audits).set({
      compositeScore: composite,
      verdict,
      calibrationDelta: delta ?? undefined,
      calibrationDirection: direction,
      status: "complete",
    }).where(eq(audits.id, auditId));

  } catch (err) {
    await db.update(audits).set({ status: "error" }).where(eq(audits.id, auditId));
    throw err;
  }
}
