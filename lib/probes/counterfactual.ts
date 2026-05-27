import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { COUNTERFACTUAL_TEMPLATE, fill } from "../prompts";
import type { TranscriptTurn } from "../adjudicate";

const NegationSchema = z.object({ negatedClaim: z.string() });

export async function runCounterfactual(
  claimText: string,
  targetModel: string,
  interrogatorModel: string,
): Promise<TranscriptTurn[]> {
  const { object } = await generateObject({
    model: getModel(interrogatorModel),
    prompt: `Write a single sentence that confidently asserts the opposite of this claim. Return JSON only.\n\nCLAIM: ${claimText}`,
    schema: NegationSchema,
  });

  const falsePressure = fill(COUNTERFACTUAL_TEMPLATE, { negatedClaim: object.negatedClaim });
  const truePressure = fill(COUNTERFACTUAL_TEMPLATE, { negatedClaim: claimText });

  const transcript: TranscriptTurn[] = [];

  for (const [turn, q] of [[1, falsePressure], [2, truePressure]] as [number, string][]) {
    transcript.push({ role: "user", content: q, turn });
    const { text } = await generateText({
      model: getModel(targetModel),
      messages: [{ role: "user", content: q }],
    });
    transcript.push({ role: "assistant", content: text, turn });
  }

  return transcript;
}
