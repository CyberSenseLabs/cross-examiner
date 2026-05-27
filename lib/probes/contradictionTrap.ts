import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { CONTRADICTION_TRAP_PROMPT, fill } from "../prompts";
import type { TranscriptTurn } from "../adjudicate";

const QuestionsSchema = z.object({
  questions: z.array(z.string()).min(2).max(3),
});

export async function runContradictionTrap(
  claimText: string,
  targetModel: string,
  interrogatorModel: string,
): Promise<TranscriptTurn[]> {
  const { object } = await generateObject({
    model: getModel(interrogatorModel),
    prompt: fill(CONTRADICTION_TRAP_PROMPT, { claimText }),
    schema: QuestionsSchema,
  });

  const transcript: TranscriptTurn[] = [];
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  for (let i = 0; i < object.questions.length; i++) {
    const q = object.questions[i];
    messages.push({ role: "user", content: q });
    transcript.push({ role: "user", content: q, turn: i + 1 });

    const { text } = await generateText({
      model: getModel(targetModel),
      messages: [...messages],
    });

    messages.push({ role: "assistant", content: text });
    transcript.push({ role: "assistant", content: text, turn: i + 1 });
  }

  return transcript;
}
