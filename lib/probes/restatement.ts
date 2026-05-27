import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { RESTATEMENT_VARIANTS_PROMPT, fill } from "../prompts";
import type { TranscriptTurn } from "../adjudicate";

const VariantsSchema = z.object({
  variants: z.array(z.string()).min(2).max(3),
});

export async function runRestatement(
  claimText: string,
  targetModel: string,
  interrogatorModel: string,
): Promise<TranscriptTurn[]> {
  const derivedQuestion = `Is it true that ${claimText}? Please explain.`;

  const { object } = await generateObject({
    model: getModel(interrogatorModel),
    prompt: fill(RESTATEMENT_VARIANTS_PROMPT, { derivedQuestion }),
    schema: VariantsSchema,
  });

  const questions = [derivedQuestion, ...object.variants];
  const transcript: TranscriptTurn[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    transcript.push({ role: "user", content: q, turn: i + 1 });
    const { text } = await generateText({
      model: getModel(targetModel),
      messages: [{ role: "user", content: q }],
    });
    transcript.push({ role: "assistant", content: text, turn: i + 1 });
  }

  return transcript;
}
