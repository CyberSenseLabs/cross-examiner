import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./providers";
import { DECOMPOSE_PROMPT, fill } from "./prompts";

const ClaimsSchema = z.object({
  claims: z.array(z.object({
    text: z.string(),
    claimType: z.enum(["factual", "opinion", "unknowable"]),
  })),
});

export async function decomposeClaims(
  originalPrompt: string,
  targetResponse: string,
  interrogatorModel: string,
) {
  const prompt = fill(DECOMPOSE_PROMPT, { originalPrompt, targetResponse });
  const { object } = await generateObject({
    model: getModel(interrogatorModel),
    prompt,
    schema: ClaimsSchema,
  });
  return object.claims;
}
