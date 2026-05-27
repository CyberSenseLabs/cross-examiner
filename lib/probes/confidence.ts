import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { CONFIDENCE_TEMPLATE, fill } from "../prompts";

const ConfidenceSchema = z.object({
  confidences: z.array(z.object({
    claimIndex: z.number(),
    confidence: z.number().min(0).max(100),
    reason: z.string(),
  })),
});

export async function runConfidence(
  claims: { text: string; index: number }[],
  targetModel: string,
): Promise<Map<number, number>> {
  const claimList = claims.map((c) => `${c.index + 1}. ${c.text}`).join("\n");
  const prompt = fill(CONFIDENCE_TEMPLATE, { claimList });

  const { object } = await generateObject({
    model: getModel(targetModel),
    prompt,
    schema: ConfidenceSchema,
  });

  const map = new Map<number, number>();
  for (const c of object.confidences) {
    map.set(c.claimIndex - 1, c.confidence);
  }
  return map;
}
