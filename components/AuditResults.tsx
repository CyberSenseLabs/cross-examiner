"use client";

import { useEffect, useState } from "react";

type Probe = {
  id: string;
  claimId: string | null;
  probeType: string;
  dimension: string;
  verdict: string | null;
  rationale: string | null;
  transcript: { role: string; content: string; turn: number }[] | null;
};

type Claim = {
  id: string;
  orderIndex: number;
  text: string;
  claimType: string;
  statedConfidence: number | null;
  survived: number | null;
};

type DimScore = {
  dimension: string;
  rawScore: number;
  weight: number;
  weightedPoints: number;
  probeCount: number;
};

type Audit = {
  id: string;
  compositeScore: number | null;
  verdict: string | null;
  calibrationDelta: number | null;
  calibrationDirection: string | null;
  targetModel: string;
  interrogatorModel: string;
  adjudicatorModel: string;
  status: string;
};

type AuditData = {
  audit: Audit;
  claims: Claim[];
  probes: Probe[];
  dimensionScores: DimScore[];
};

const VERDICT_COLORS: Record<string, string> = {
  pass: "text-green-700 bg-green-50 border-green-200",
  partial: "text-yellow-700 bg-yellow-50 border-yellow-200",
  fail: "text-red-700 bg-red-50 border-red-200",
  fabricated_source: "text-red-800 bg-red-100 border-red-300 font-semibold",
  confident_fabrication: "text-red-800 bg-red-100 border-red-300 font-semibold",
};

const SCORE_COLORS: Record<string, string> = {
  "Verified, reliable": "text-green-700",
  "Sound with caveats": "text-yellow-700",
  "Unreliable, material defects": "text-orange-700",
  "Likely fabrication, fails": "text-red-700",
};

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-zinc-400 text-xs">pending</span>;
  const cls = VERDICT_COLORS[verdict] ?? "text-zinc-600 bg-zinc-50 border-zinc-200";
  return (
    <span className={`inline-block border rounded px-1.5 py-0.5 text-xs ${cls}`}>
      {verdict.replace("_", " ")}
    </span>
  );
}

function TranscriptViewer({ transcript }: { transcript: Probe["transcript"] }) {
  const [open, setOpen] = useState(false);
  if (!transcript?.length) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-zinc-500 underline underline-offset-2"
      >
        {open ? "Hide" : "View"} transcript ({transcript.length} turns)
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {transcript.map((t, i) => (
            <div key={i} className={`text-xs rounded px-2 py-1.5 text-zinc-900 ${t.role === "user" ? "bg-zinc-100" : "bg-blue-50"}`}>
              <span className="font-medium capitalize">{t.role}:</span>{" "}
              <span className="whitespace-pre-wrap">{t.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuditResults({ auditId }: { auditId: string }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadReport() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/audit/${auditId}/report`);
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${auditId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    fetch(`/api/audit/${auditId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [auditId]);

  if (!data) return <div className="mt-8 text-sm text-zinc-500 animate-pulse">Loading results…</div>;

  const { audit, claims, probes: probeList, dimensionScores } = data;
  const scoreColor = SCORE_COLORS[audit.verdict ?? ""] ?? "text-zinc-700";

  return (
    <div className="mt-10 space-y-8">
      {/* Score header */}
      <div className="rounded-lg border border-zinc-200 px-6 py-5">
        <div className="flex justify-end mb-3">
          <button
            onClick={downloadReport}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            {downloading ? "Generating…" : "Download PDF report"}
          </button>
        </div>
        <div className="flex items-baseline gap-3">
          <span className={`text-5xl font-bold tabular-nums ${scoreColor}`}>
            {audit.compositeScore ?? "—"}
          </span>
          <span className="text-sm text-zinc-500">/ 100</span>
        </div>
        <p className={`mt-1 text-sm font-medium ${scoreColor}`}>{audit.verdict}</p>

        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <span className="text-zinc-400">Target</span>
          <span className="text-zinc-700 font-mono">{audit.targetModel}</span>
          <span className="text-zinc-400">Interrogator</span>
          <span className="text-zinc-700 font-mono">{audit.interrogatorModel}</span>
          <span className="text-zinc-400">Adjudicator</span>
          <span className="text-zinc-700 font-mono">{audit.adjudicatorModel}</span>
          <span className="text-zinc-400">Audit ID</span>
          <span className="text-zinc-400 font-mono">{auditId.slice(0, 8)}</span>
        </div>

        {audit.calibrationDelta != null && (
          <p className="mt-3 text-xs text-zinc-500">
            Calibration: Δ{audit.calibrationDelta.toFixed(3)} —{" "}
            <span className={audit.calibrationDirection === "overconfident" ? "text-orange-600" : audit.calibrationDirection === "underconfident" ? "text-blue-600" : ""}>
              {audit.calibrationDirection}
            </span>
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-zinc-400 border-l-2 border-zinc-200 pl-3">
        Probes 1–8 measure coherence and conviction, not truth. The ground truth probe (weight 30) is
        the only dimension that tests factual accuracy. This score does not certify correctness.
      </p>

      {/* Dimension breakdown */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Dimension scores</h2>
        <div className="space-y-2">
          {dimensionScores
            .sort((a, b) => b.weight - a.weight)
            .map((d) => (
              <div key={d.dimension} className="flex items-center gap-3">
                <div className="w-48 text-xs text-zinc-600 truncate">{d.dimension.replace(/_/g, " ")}</div>
                <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${d.rawScore >= 0.8 ? "bg-green-500" : d.rawScore >= 0.5 ? "bg-yellow-400" : "bg-red-500"}`}
                    style={{ width: `${d.rawScore * 100}%` }}
                  />
                </div>
                <div className="w-12 text-right text-xs text-zinc-500">
                  {Math.round(d.rawScore * 100)}%
                </div>
                <div className="w-16 text-right text-xs text-zinc-400">
                  ×{d.weight} = {d.weightedPoints.toFixed(1)}
                </div>
              </div>
            ))}
          <div className="flex items-center gap-3 pt-1 border-t border-zinc-200">
            <div className="w-48 text-xs text-zinc-500 font-medium">Total</div>
            <div className="flex-1" />
            <div className="w-12" />
            <div className="w-16 text-right text-xs text-zinc-500 font-medium">
              {dimensionScores.reduce((s, d) => s + d.weightedPoints, 0).toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Claims + probe drill-down */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Claims ({claims.filter((c) => c.claimType === "factual").length} factual)</h2>
        <div className="space-y-3">
          {claims
            .filter((c) => c.claimType === "factual")
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((claim) => {
              const cp = probeList.filter((p) => p.claimId === claim.id);
              const isOpen = expandedClaim === claim.id;
              const survivedLabel = claim.survived === 1 ? "passed" : claim.survived === 0 ? "failed" : "partial";
              const survivedColor = claim.survived === 1 ? "text-green-600" : claim.survived === 0 ? "text-red-600" : "text-yellow-600";

              return (
                <div key={claim.id} className="rounded-md border border-zinc-200">
                  <button
                    className="w-full text-left px-4 py-3 flex items-start gap-3"
                    onClick={() => setExpandedClaim(isOpen ? null : claim.id)}
                  >
                    <span className={`text-xs font-medium mt-0.5 ${survivedColor}`}>{survivedLabel}</span>
                    <span className="text-sm text-zinc-700 flex-1">{claim.text}</span>
                    {claim.statedConfidence != null && (
                      <span className="text-xs text-zinc-400 whitespace-nowrap">
                        conf {claim.statedConfidence}%
                      </span>
                    )}
                    <span className="text-zinc-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-100 px-4 py-3 space-y-3">
                      {cp.map((p) => (
                        <div key={p.id}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 font-medium">{p.probeType.replace(/_/g, " ")}</span>
                            <VerdictBadge verdict={p.verdict} />
                          </div>
                          {p.rationale && (
                            <p className="mt-1 text-xs text-zinc-600">{p.rationale}</p>
                          )}
                          <TranscriptViewer transcript={p.transcript} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
