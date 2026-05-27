import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAudit, runPipeline } from "@/lib/pipeline";
import {
  ALL_MODELS,
  DEFAULT_ADJUDICATOR,
  DEFAULT_INTERROGATOR,
  SUPPORTED_TARGETS,
  resolveInterrogator,
} from "@/lib/providers";

export const maxDuration = 300;

const BodySchema = z.object({
  originalPrompt: z.string().min(1),
  targetResponse: z.string().optional(),
  targetModel: z.enum(SUPPORTED_TARGETS),
  interrogatorModel: z.enum(ALL_MODELS).optional(),
  adjudicatorModel: z.enum(ALL_MODELS).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { originalPrompt, targetResponse, targetModel } = parsed.data;
  // Explicit user choices are used as-is. Auto-resolve only when no preference is given.
  const interrogatorModel = parsed.data.interrogatorModel
    ?? resolveInterrogator(targetModel, DEFAULT_INTERROGATOR);
  const adjudicatorModel = parsed.data.adjudicatorModel ?? DEFAULT_ADJUDICATOR;

  const pipelineInput = { originalPrompt, targetResponse, targetModel, interrogatorModel, adjudicatorModel };

  try {
    const auditId = await createAudit(pipelineInput);

    // Fire pipeline in background so the client gets the ID immediately and can poll for progress.
    // On Vercel, wrap with waitUntil() from @vercel/functions to prevent early termination.
    runPipeline(auditId, pipelineInput).catch((err) => {
      console.error("[audit] pipeline error:", err);
    });

    return NextResponse.json({ auditId });
  } catch (err) {
    console.error("[audit] failed to create audit:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
