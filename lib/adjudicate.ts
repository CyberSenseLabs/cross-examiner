import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./providers";
import { ADJUDICATOR_PROMPT, fill } from "./prompts";

const VerdictSchema = z.object({
  verdict: z.enum(["pass", "partial", "fail", "fabricated_source", "confident_fabrication"]),
  rationale: z.string(),
});

export type TranscriptTurn = { role: "user" | "assistant"; content: string; turn: number };

export async function adjudicate(
  probeType: string,
  claimText: string,
  transcript: TranscriptTurn[],
  adjudicatorModel: string,
): Promise<{ verdict: string; rationale: string }> {
  const prompt = fill(ADJUDICATOR_PROMPT, {
    probeType,
    claimText,
    transcript: JSON.stringify(transcript, null, 2),
  });

  const { object } = await generateObject({
    model: getModel(adjudicatorModel),
    prompt,
    schema: VerdictSchema,
    temperature: 0.1,
  });

  return object;
}
