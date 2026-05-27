"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: string; content: string; turn: number };

type Claim = { id: string; claimType: string; text: string };
type Probe = {
  id: string;
  claimId: string | null;
  probeType: string;
  verdict: string | null;
  transcript: Turn[] | null;
};
type PollData = {
  audit: { status: string; compositeScore: number | null; targetResponse: string; interrogatorModel: string; targetModel: string };
  claims: Claim[];
  probes: Probe[];
};

const BATTERY_PROBES = [
  { type: "restatement",        label: "Restatement invariance" },
  { type: "atomic_claim",       label: "Atomic claim audit" },
  { type: "contradiction_trap", label: "Contradiction trap" },
  { type: "specificity",        label: "Specificity pressure" },
  { type: "provenance",         label: "Provenance challenge" },
  { type: "boundary",           label: "Boundary probe" },
  { type: "counterfactual",     label: "Counterfactual pushback" },
  { type: "self_critique",      label: "Self-critique" },
];

const PROBE_LABEL: Record<string, string> = Object.fromEntries(
  [...BATTERY_PROBES, { type: "ground_truth", label: "Ground-truth check" }].map(p => [p.type, p.label])
);

const VERDICT_COLORS: Record<string, string> = {
  pass:                  "text-green-700 bg-green-50 border-green-200",
  partial:               "text-yellow-700 bg-yellow-50 border-yellow-200",
  fail:                  "text-red-700 bg-red-50 border-red-200",
  fabricated_source:     "text-red-800 bg-red-100 border-red-300",
  confident_fabrication: "text-red-800 bg-red-100 border-red-300",
};

type StepStatus = "pending" | "active" | "done" | "error";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")   return <span className="text-green-600 text-sm">✓</span>;
  if (status === "error")  return <span className="text-red-600 text-sm">✗</span>;
  if (status === "active") return <span className="inline-block w-3 h-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin mt-0.5" />;
  return <span className="text-zinc-300 text-sm">○</span>;
}

function stepText(status: StepStatus) {
  if (status === "pending") return "text-zinc-400";
  if (status === "done")    return "text-zinc-700";
  return "text-zinc-800";
}

function ProbeExchange({
  probe,
  interrogatorModel,
  targetModel,
}: {
  probe: Probe;
  interrogatorModel: string;
  targetModel: string;
}) {
  const [open, setOpen] = useState(true);
  const turns = probe.transcript ?? [];
  const userTurns = turns.filter(t => t.role === "user");
  const assistantTurns = turns.filter(t => t.role === "assistant");
  const isMultiTurn = userTurns.length > 1;
  const verdictCls = probe.verdict ? (VERDICT_COLORS[probe.verdict] ?? "text-zinc-600 bg-zinc-50 border-zinc-200") : "";

  return (
    <div className="rounded-md border border-zinc-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-700">
            {PROBE_LABEL[probe.probeType] ?? probe.probeType.replace(/_/g, " ")}
          </span>
          {isMultiTurn && (
            <span className="text-xs text-zinc-400">{userTurns.length} turns</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {probe.verdict && (
            <span className={`text-xs border rounded px-1.5 py-0.5 ${verdictCls}`}>
              {probe.verdict.replace(/_/g, " ")}
            </span>
          )}
          <span className="text-zinc-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && turns.length > 0 && (
        <div className="divide-y divide-zinc-100">
          {userTurns.map((q, i) => {
            const a = assistantTurns[i];
            return (
              <div key={i} className="grid grid-cols-2 divide-x divide-zinc-100">
                {/* Interrogator question */}
                <div className="p-3 bg-zinc-50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
                    Interrogator · <span className="font-mono normal-case">{interrogatorModel}</span>
                    {isMultiTurn && <span className="ml-1 text-zinc-300">turn {i + 1}</span>}
                  </p>
                  <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{q.content}</p>
                </div>
                {/* Target response */}
                <div className="p-3 bg-white">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400 mb-1.5">
                    Target · <span className="font-mono normal-case">{targetModel}</span>
                    {isMultiTurn && <span className="ml-1 text-blue-200">turn {i + 1}</span>}
                  </p>
                  {a ? (
                    <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">awaiting response…</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiveExchanges({
  claims,
  probes,
  interrogatorModel,
  targetModel,
}: {
  claims: Claim[];
  probes: Probe[];
  interrogatorModel: string;
  targetModel: string;
}) {
  const completedProbes = probes.filter(p => p.verdict && p.transcript?.length);
  if (!completedProbes.length) return null;

  // Probes with a claimId, grouped by claim
  const claimProbes = claims
    .filter(c => c.claimType === "factual")
    .map(claim => ({
      claim,
      probes: completedProbes.filter(p => p.claimId === claim.id),
    }))
    .filter(g => g.probes.length > 0);

  // Response-level probes (no claimId)
  const responseProbes = completedProbes.filter(p => !p.claimId);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-800">Live exchanges</h2>
        <span className="text-xs text-zinc-400">{completedProbes.length} probe{completedProbes.length !== 1 ? "s" : ""} complete</span>
      </div>

      <div className="space-y-6">
        {claimProbes.map(({ claim, probes: cp }) => (
          <div key={claim.id}>
            <p className="text-xs text-zinc-500 mb-2 pl-1 border-l-2 border-zinc-200">
              <span className="font-medium text-zinc-700">Claim:</span> {claim.text}
            </p>
            <div className="space-y-2">
              {cp.map(probe => (
                <ProbeExchange
                  key={probe.id}
                  probe={probe}
                  interrogatorModel={interrogatorModel}
                  targetModel={targetModel}
                />
              ))}
            </div>
          </div>
        ))}

        {responseProbes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">Response-level probes</p>
            <div className="space-y-2">
              {responseProbes.map(probe => (
                <ProbeExchange
                  key={probe.id}
                  probe={probe}
                  interrogatorModel={interrogatorModel}
                  targetModel={targetModel}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditProgress({
  auditId,
  onComplete,
  onResponseGenerated,
}: {
  auditId: string;
  onComplete: () => void;
  onResponseGenerated?: (text: string) => void;
}) {
  const [data, setData] = useState<PollData | null>(null);
  const responseFired = useRef(false);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/audit/${auditId}`);
        const json: PollData = await res.json();
        if (stopped) return;
        setData(json);

        if (
          !responseFired.current &&
          onResponseGenerated &&
          json.audit?.targetResponse &&
          json.audit.targetResponse !== "__pending__"
        ) {
          responseFired.current = true;
          onResponseGenerated(json.audit.targetResponse);
        }

        if (json.audit?.status === "complete") {
          stopped = true;
          onComplete();
        }
      } catch {}
    }

    poll();
    const id = setInterval(() => { if (!stopped) poll(); }, 3000);
    return () => { stopped = true; clearInterval(id); };
  }, [auditId, onComplete, onResponseGenerated]);

  const status       = data?.audit?.status ?? "running";
  const response     = data?.audit?.targetResponse ?? "";
  const claimCount   = (data?.claims ?? []).filter(c => c.claimType === "factual").length;
  const probeList    = data?.probes ?? [];
  const responseReady = response && response !== "__pending__";

  const step1: StepStatus = "done";
  const step2: StepStatus = responseReady ? "done" : "active";
  const step3: StepStatus = !responseReady ? "pending" : claimCount > 0 ? "done" : "active";

  const batteryDone     = probeList.filter(p => BATTERY_PROBES.some(b => b.type === p.probeType) && p.verdict).length;
  const batteryExpected = claimCount * BATTERY_PROBES.length;
  const step4: StepStatus =
    step3 !== "done"                                      ? "pending" :
    batteryDone >= batteryExpected && batteryExpected > 0 ? "done"    : "active";

  const gtDone = probeList.filter(p => p.probeType === "ground_truth" && p.verdict).length;
  const step5: StepStatus =
    step4 !== "done"                       ? "pending" :
    gtDone >= claimCount && claimCount > 0 ? "done"    : "active";

  const hasScore = data?.audit?.compositeScore != null;
  const step6: StepStatus = step5 !== "done" ? "pending" : hasScore ? "done" : "active";

  return (
    <div className="mt-8">
      <p className="text-sm font-medium text-zinc-700 mb-4">Running audit…</p>

      <ol className="space-y-4 text-sm">
        <li className="flex items-start gap-2.5">
          <StepIcon status={step1} />
          <span className={stepText(step1)}>Audit created</span>
        </li>

        <li className="flex items-start gap-2.5">
          <StepIcon status={step2} />
          <span className={stepText(step2)}>
            {responseReady ? "Target response ready" : "Generating target response…"}
          </span>
        </li>

        <li className="flex items-start gap-2.5">
          <StepIcon status={step3} />
          <span className={stepText(step3)}>
            Decomposing response into claims
            {claimCount > 0 && (
              <span className="ml-1.5 text-zinc-500 font-normal">
                — {claimCount} factual claim{claimCount !== 1 ? "s" : ""} found
              </span>
            )}
          </span>
        </li>

        <li className="space-y-2">
          <div className="flex items-start gap-2.5">
            <StepIcon status={step4} />
            <span className={stepText(step4)}>
              Probe battery
              {batteryExpected > 0 && (
                <span className="ml-1.5 text-zinc-500 font-normal">
                  — {batteryDone} / {batteryExpected} complete
                </span>
              )}
            </span>
          </div>
          {step4 !== "pending" && claimCount > 0 && (
            <div className="ml-7 grid grid-cols-2 gap-x-6 gap-y-1.5">
              {BATTERY_PROBES.map(({ type, label }) => {
                const done   = probeList.filter(p => p.probeType === type && p.verdict).length;
                const isDone = done >= claimCount;
                return (
                  <div key={type} className="flex items-center gap-1.5 text-xs">
                    <span className={isDone ? "text-green-500" : "text-zinc-300"}>{isDone ? "✓" : "○"}</span>
                    <span className={isDone ? "text-zinc-600" : "text-zinc-400"}>{label}</span>
                    {!isDone && done > 0 && <span className="text-zinc-400">({done}/{claimCount})</span>}
                  </div>
                );
              })}
            </div>
          )}
        </li>

        <li className="flex items-start gap-2.5">
          <StepIcon status={step5} />
          <span className={stepText(step5)}>
            Ground-truth check
            {step5 !== "pending" && claimCount > 0 && (
              <span className="ml-1.5 text-zinc-500 font-normal">
                — {gtDone} / {claimCount} claim{claimCount !== 1 ? "s" : ""} verified
              </span>
            )}
          </span>
        </li>

        <li className="flex items-start gap-2.5">
          <StepIcon status={step6} />
          <span className={stepText(step6)}>Computing score</span>
        </li>
      </ol>

      {status === "error" && (
        <p className="mt-4 text-sm text-red-600">
          The audit encountered an error. Check the browser console for details.
        </p>
      )}

      {data && (
        <LiveExchanges
          claims={data.claims}
          probes={data.probes}
          interrogatorModel={data.audit.interrogatorModel}
          targetModel={data.audit.targetModel}
        />
      )}
    </div>
  );
}
