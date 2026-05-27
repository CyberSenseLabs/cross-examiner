import { generateText } from "ai";
import { getModel } from "../providers";
import { SPECIFICITY_TEMPLATE, fill } from "../prompts";
import type { TranscriptTurn } from "../adjudicate";

export async function runSpecificity(
  claimText: string,
  targetModel: string,
): Promise<TranscriptTurn[]> {
  const q = fill(SPECIFICITY_TEMPLATE, { claimText });

  const { text } = await generateText({
    model: getModel(targetModel),
    messages: [{ role: "user", content: q }],
  });

  return [
    { role: "user", content: q, turn: 1 },
    { role: "assistant", content: text, turn: 1 },
  ];
}
