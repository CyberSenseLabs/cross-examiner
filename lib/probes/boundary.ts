import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { BOUNDARY_PROBE_PROMPT, fill } from "../prompts";
import type { TranscriptTurn } from "../adjudicate";

const QuestionsSchema = z.object({
  questions: z.array(z.string()).min(1).max(2),
});

export async function runBoundary(
  claimText: string,
  targetModel: string,
  interrogatorModel: string,
): Promise<TranscriptTurn[]> {
  const topic = claimText.slice(0, 200);

  const { object } = await generateObject({
    model: getModel(interrogatorModel),
    prompt: fill(BOUNDARY_PROBE_PROMPT, { topic }),
    schema: QuestionsSchema,
  });

  const transcript: TranscriptTurn[] = [];

  for (let i = 0; i < object.questions.length; i++) {
    const q = object.questions[i];
    transcript.push({ role: "user", content: q, turn: i + 1 });

    const { text } = await generateText({
      model: getModel(targetModel),
      messages: [{ role: "user", content: q }],
    });

    transcript.push({ role: "assistant", content: text, turn: i + 1 });
  }

  return transcript;
}
