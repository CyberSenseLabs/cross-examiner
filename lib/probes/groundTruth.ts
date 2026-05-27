import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import type { TranscriptTurn } from "../adjudicate";

const SearchResultSchema = z.object({
  verdict: z.enum(["pass", "partial", "fail"]),
  rationale: z.string(),
  sources: z.array(z.string()),
});

async function searchWeb(query: string): Promise<string> {
  const apiKey = process.env.SEARCH_API_KEY;
  if (!apiKey) return "No search API key configured.";

  const res = await fetch(`https://api.tavily.com/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 3,
    }),
  });

  if (!res.ok) return `Search failed: ${res.statusText}`;

  const data = await res.json();
  const results = (data.results ?? []) as { title: string; url: string; content: string }[];
  return results.map((r) => `[${r.title}] ${r.url}\n${r.content}`).join("\n\n");
}

export async function runGroundTruth(
  claimText: string,
  interrogatorModel: string,
): Promise<TranscriptTurn[]> {
  const searchResults = await searchWeb(claimText);

  const prompt = `You are fact-checking a claim against web search results.
CLAIM: ${claimText}
SEARCH RESULTS: ${searchResults}

Return a verdict:
  pass    - an authoritative source supports the claim
  fail    - a source contradicts the claim
  partial - nothing conclusive found

Return JSON only with verdict, rationale, and sources array.`;

  const { object } = await generateObject({
    model: getModel(interrogatorModel),
    prompt,
    schema: SearchResultSchema,
  });

  return [
    { role: "user", content: `CLAIM: ${claimText}\n\nSEARCH RESULTS:\n${searchResults}`, turn: 1 },
    {
      role: "assistant",
      content: `Verdict: ${object.verdict}\n\nRationale: ${object.rationale}\n\nSources: ${object.sources.join(", ")}`,
      turn: 1,
    },
  ];
}
