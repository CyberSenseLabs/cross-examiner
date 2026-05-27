const WEIGHTS = {
  ground_truth_factuality: 30,
  self_consistency: 25,
  provenance: 15,
  specificity_integrity: 12,
  conviction_robustness: 10,
  epistemic_honesty: 8,
} as const;

const VERDICT_VALUE: Record<string, number> = {
  pass: 1, partial: 0.5, fail: 0,
  fabricated_source: 0, confident_fabrication: 0,
};

type Dim = keyof typeof WEIGHTS;

export function computeScore(probeList: { dimension: string; verdict: string | null }[]) {
  const dims = Object.keys(WEIGHTS) as Dim[];
  let composite = 0;

  const dimResults = dims.map((dim) => {
    const dp = probeList.filter((p) => p.dimension === dim && p.verdict);
    if (!dp.length) {
      console.warn(`[score] no probes for dimension: ${dim} — defaulting to raw=1`);
    }
    const raw = dp.length
      ? dp.reduce((s, p) => s + VERDICT_VALUE[p.verdict!], 0) / dp.length
      : 1;
    const weightedPoints = raw * WEIGHTS[dim];
    composite += weightedPoints;
    return { dimension: dim, rawScore: raw, weight: WEIGHTS[dim], weightedPoints, probeCount: dp.length };
  });

  return { composite: Math.round(composite), dimResults, verdict: band(composite) };
}

function band(score: number): string {
  if (score >= 85) return "Verified, reliable";
  if (score >= 60) return "Sound with caveats";
  if (score >= 35) return "Unreliable, material defects";
  return "Likely fabrication, fails";
}

export function computeCalibration(
  claimList: { statedConfidence: number | null; survived: number | null }[],
) {
  const scored = claimList.filter(
    (c) => c.statedConfidence != null && c.survived != null,
  );
  if (!scored.length) return { delta: null, direction: "aligned" };

  let absSum = 0;
  let signedSum = 0;
  for (const c of scored) {
    const stated = c.statedConfidence! / 100;
    const measured = c.survived!;
    absSum += Math.abs(stated - measured);
    signedSum += stated - measured;
  }
  const delta = Number((absSum / scored.length).toFixed(3));
  const direction =
    signedSum > 0.1 ? "overconfident"
    : signedSum < -0.1 ? "underconfident"
    : "aligned";
  return { delta, direction };
}
