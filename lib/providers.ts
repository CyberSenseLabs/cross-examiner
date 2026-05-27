import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

export type ModelId = string;

export function getModel(modelId: ModelId) {
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) {
    return openai(modelId);
  }
  return anthropic(modelId);
}

// Cross-family interrogation (Anthropic target → OpenAI interrogator) gives strongest
// independence. If only one provider is available, different Claude tiers are used instead.
export const DEFAULT_TARGET = "gpt-4.1";
export const DEFAULT_INTERROGATOR = "claude-sonnet-4-6";
export const DEFAULT_ADJUDICATOR = "claude-sonnet-4-6";

// Returns an interrogator that differs from the target where possible.
// Prefers a different provider family; falls back to a different Claude tier.
export function resolveInterrogator(targetModel: string, preferred = DEFAULT_INTERROGATOR): string {
  if (preferred !== targetModel) return preferred;
  // Same model — step to a different tier
  if (targetModel.includes("haiku")) return "claude-sonnet-4-6";
  return "claude-haiku-4-5-20251001";
}
// Premier/high-latency models excluded from target selection.
export const SUPPORTED_TARGETS = [
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "o4-mini",
] as const;

// Full list available for interrogator and adjudicator roles.
export const ALL_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "o3-mini",
  "o4-mini",
] as const;

export function modelFamily(modelId: string): "anthropic" | "openai" | "unknown" {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) return "openai";
  return "unknown";
}
