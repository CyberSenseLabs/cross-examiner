"use client";

import { useCallback, useState } from "react";
import { ALL_MODELS, DEFAULT_ADJUDICATOR, DEFAULT_INTERROGATOR, DEFAULT_TARGET, modelFamily, SUPPORTED_TARGETS } from "@/lib/providers";
import AuditProgress from "@/components/AuditProgress";
import AuditResults from "@/components/AuditResults";

type Phase = "idle" | "submitting" | "running" | "complete" | "error";

const SELECT_CLS = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [responseGenerated, setResponseGenerated] = useState(false);
  const [targetModel, setTargetModel] = useState<string>(DEFAULT_TARGET);
  const [interrogatorModel, setInterrogatorModel] = useState<string>(DEFAULT_INTERROGATOR);
  const [adjudicatorModel, setAdjudicatorModel] = useState<string>(DEFAULT_ADJUDICATOR);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);

  const handleComplete = useCallback(() => setPhase("complete"), []);
  const handleResponseGenerated = useCallback((text: string) => {
    setResponse(text);
    setResponseGenerated(true);
  }, []);

  const weakIndependence = modelFamily(targetModel) === modelFamily(interrogatorModel);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setPhase("submitting");
    setError(null);
    setAuditId(null);
    setResponseGenerated(false);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt: prompt,
          targetResponse: response.trim() || undefined,
          targetModel,
          interrogatorModel,
          adjudicatorModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setAuditId(data.auditId);
      setPhase("running");
    } catch (err) {
      setError(String(err));
      setPhase("error");
    }
  }

  const busy = phase === "submitting" || phase === "running";

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Cross-Examiner</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Interrogates an AI response with a structured probe battery and scores its integrity.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Original prompt</label>
          <textarea
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[80px] disabled:opacity-50"
            placeholder="The prompt that was given to the model…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-2">
            Target response
            {responseGenerated ? (
              <span className="text-xs font-normal text-zinc-400 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">
                model-generated
              </span>
            ) : (
              <span className="font-normal text-zinc-400">(optional — leave blank to generate)</span>
            )}
          </label>
          <textarea
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[120px] disabled:opacity-50"
            placeholder="Paste the AI response to audit…"
            value={response}
            onChange={(e) => { setResponse(e.target.value); setResponseGenerated(false); }}
            disabled={busy}
          />
        </div>

        {/* Model role selectors */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Target
              </label>
              <select
                className={SELECT_CLS}
                value={targetModel}
                onChange={(e) => setTargetModel(e.target.value)}
                disabled={busy}
              >
                {SUPPORTED_TARGETS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Interrogator
              </label>
              <select
                className={SELECT_CLS}
                value={interrogatorModel}
                onChange={(e) => setInterrogatorModel(e.target.value)}
                disabled={busy}
              >
                {ALL_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Adjudicator
              </label>
              <select
                className={SELECT_CLS}
                value={adjudicatorModel}
                onChange={(e) => setAdjudicatorModel(e.target.value)}
                disabled={busy}
              >
                {ALL_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {weakIndependence && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Target and interrogator are from the same provider family — cross-model independence is reduced.
              For strongest results, use models from different providers.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {phase === "submitting" ? "Starting…" : busy ? "Audit in progress…" : "Run audit"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {phase === "running" && auditId && (
        <AuditProgress
          auditId={auditId}
          onComplete={handleComplete}
          onResponseGenerated={handleResponseGenerated}
        />
      )}

      {phase === "complete" && auditId && (
        <AuditResults auditId={auditId} />
      )}
    </main>
  );
}
