import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, color: "#1a1a1a" },
  // Layout
  row: { flexDirection: "row" },
  col2: { flexDirection: "row", gap: 20 },
  half: { flex: 1 },
  // Spacing
  mb2: { marginBottom: 2 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  // Text
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingBottom: 4 },
  h3: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  label: { fontSize: 7.5, color: "#6b6b6b" },
  mono: { fontFamily: "Courier", fontSize: 8 },
  small: { fontSize: 7.5, color: "#6b6b6b" },
  // Score
  scoreBox: { padding: 16, backgroundColor: "#f9f9f9", borderWidth: 1, borderColor: "#e5e5e5", marginBottom: 16 },
  scoreBig: { fontSize: 36, fontFamily: "Helvetica-Bold" },
  scoreSub: { fontSize: 10, color: "#6b6b6b", marginTop: 2 },
  // Badges
  badgePass: { fontSize: 7.5, color: "#166534", backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", paddingHorizontal: 4, paddingVertical: 1 },
  badgePartial: { fontSize: 7.5, color: "#854d0e", backgroundColor: "#fefce8", borderWidth: 1, borderColor: "#fef08a", paddingHorizontal: 4, paddingVertical: 1 },
  badgeFail: { fontSize: 7.5, color: "#991b1b", backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 4, paddingVertical: 1 },
  badgeGray: { fontSize: 7.5, color: "#525252", backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e5e5e5", paddingHorizontal: 4, paddingVertical: 1 },
  // Table
  tableHead: { flexDirection: "row", backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e5e5e5", padding: 5 },
  tableRow: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#e5e5e5", padding: 5 },
  tableRowAlt: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#e5e5e5", padding: 5, backgroundColor: "#fafafa" },
  // Probe card
  probeCard: { borderWidth: 1, borderColor: "#e5e5e5", marginBottom: 8 },
  probeHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f5f5f5", padding: 6 },
  turnRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  turnLeft: { flex: 1, padding: 6, backgroundColor: "#f9f9f9", borderRightWidth: 1, borderRightColor: "#f0f0f0" },
  turnRight: { flex: 1, padding: 6 },
  // Divider
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginVertical: 12 },
  // Hard fail
  // Progress bar bg
  barBg: { height: 6, backgroundColor: "#e5e5e5", flex: 1 },
  barFillGreen:   { height: 6, backgroundColor: "#22c55e" },
  barFillYellow:  { height: 6, backgroundColor: "#eab308" },
  barFillRed:     { height: 6, backgroundColor: "#ef4444" },
});

type Turn = { role: string; content: string; turn: number };
type Probe = {
  id: string;
  claimId: string | null;
  probeType: string;
  dimension: string;
  verdict: string | null;
  rationale: string | null;
  transcript: Turn[] | null;
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
  originalPrompt: string;
  targetResponse: string;
  compositeScore: number | null;
  verdict: string | null;
  calibrationDelta: number | null;
  calibrationDirection: string | null;
  targetModel: string;
  interrogatorModel: string;
  adjudicatorModel: string;
  createdAt: string;
};

const PROBE_LABELS: Record<string, string> = {
  restatement: "Restatement invariance",
  atomic_claim: "Atomic claim audit",
  contradiction_trap: "Contradiction trap",
  specificity: "Specificity pressure",
  provenance: "Provenance challenge",
  boundary: "Boundary probe",
  counterfactual: "Counterfactual pushback",
  self_critique: "Self-critique",
  ground_truth: "Ground-truth check",
  confidence: "Confidence elicitation",
};

function verdictBadgeStyle(v: string | null) {
  if (v === "pass") return S.badgePass;
  if (v === "partial") return S.badgePartial;
  if (!v || v === "fail" || v === "fabricated_source" || v === "confident_fabrication") return S.badgeFail;
  return S.badgeGray;
}

function scoreColor(score: number | null): string {
  if (!score) return "#525252";
  if (score >= 85) return "#166534";
  if (score >= 60) return "#854d0e";
  if (score >= 35) return "#c2410c";
  return "#991b1b";
}

function ProbeSection({ probe, interrogatorModel, targetModel }: { probe: Probe; interrogatorModel: string; targetModel: string }) {
  const turns = probe.transcript ?? [];
  const userTurns = turns.filter(t => t.role === "user");
  const assistantTurns = turns.filter(t => t.role === "assistant");

  return (
    <View style={S.probeCard}>
      <View style={S.probeHeader}>
        <Text style={S.h3}>{PROBE_LABELS[probe.probeType] ?? probe.probeType.replace(/_/g, " ")}</Text>
        {probe.verdict && (
          <Text style={verdictBadgeStyle(probe.verdict)}>{probe.verdict.replace(/_/g, " ")}</Text>
        )}
      </View>
      {probe.rationale && (
        <View style={{ padding: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
          <Text style={S.small}>{probe.rationale}</Text>
        </View>
      )}
      {userTurns.map((q, i) => {
        const a = assistantTurns[i];
        return (
          <View key={i} style={S.turnRow}>
            <View style={S.turnLeft}>
              <Text style={[S.label, S.mb2]}>Interrogator · {interrogatorModel}</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.5 }}>{q.content}</Text>
            </View>
            <View style={S.turnRight}>
              <Text style={[S.label, S.mb2, { color: "#3b82f6" }]}>Target · {targetModel}</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.5 }}>{a?.content ?? "—"}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function AuditReportDocument({
  audit,
  claims,
  probes,
  dimensionScores,
}: {
  audit: Audit;
  claims: Claim[];
  probes: Probe[];
  dimensionScores: DimScore[];
}) {
  const factualClaims = claims
    .filter(c => c.claimType === "factual")
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const groundTruthProbes = probes.filter(p => p.probeType === "ground_truth");
  const batteryProbes = probes.filter(p => p.probeType !== "ground_truth");

  const color = scoreColor(audit.compositeScore);
  const date = new Date(audit.createdAt).toLocaleDateString("en-AU", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <Document title={`Audit Report · ${audit.id.slice(0, 8)}`} author="Cross-Examiner">
      {/* ── Page 1: Header + Executive Summary + Dimension Scores ── */}
      <Page size="A4" style={S.page}>
        {/* Title */}
        <View style={S.mb16}>
          <Text style={S.h1}>Cross-Examiner Audit Report</Text>
          <Text style={S.small}>Audit ID: {audit.id.slice(0, 8)} · {date}</Text>
        </View>

        {/* Score card */}
        <View style={S.scoreBox}>
          <View style={[S.row, { alignItems: "flex-end", gap: 8, marginBottom: 6 }]}>
            <Text style={[S.scoreBig, { color }]}>{audit.compositeScore ?? "—"}</Text>
            <Text style={S.scoreSub}>/ 100</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color, marginBottom: 10 }}>
            {audit.verdict ?? "—"}
          </Text>
          <View style={[S.row, { gap: 24 }]}>
            <View>
              <Text style={S.label}>Target model</Text>
              <Text style={[S.mono, S.mb4]}>{audit.targetModel}</Text>
              <Text style={S.label}>Interrogator model</Text>
              <Text style={[S.mono, S.mb4]}>{audit.interrogatorModel}</Text>
              <Text style={S.label}>Adjudicator model</Text>
              <Text style={S.mono}>{audit.adjudicatorModel}</Text>
            </View>
            {audit.calibrationDelta != null && (
              <View>
                <Text style={S.label}>Calibration Δ</Text>
                <Text style={[S.mono, S.mb4]}>{audit.calibrationDelta.toFixed(3)}</Text>
                <Text style={S.label}>Direction</Text>
                <Text style={S.mono}>{audit.calibrationDirection ?? "—"}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Original prompt */}
        <Text style={S.h2}>Original Prompt</Text>
        <Text style={{ fontSize: 8.5, lineHeight: 1.6, marginBottom: 16 }}>{audit.originalPrompt}</Text>

        {/* Target response */}
        <Text style={S.h2}>Target Response</Text>
        <Text style={{ fontSize: 8.5, lineHeight: 1.6, marginBottom: 16 }}>{audit.targetResponse}</Text>

        {/* Dimension scores */}
        <Text style={S.h2}>Dimension Scores</Text>
        <View style={[S.tableHead, { marginBottom: 0 }]}>
          <Text style={[S.label, { flex: 3 }]}>Dimension</Text>
          <Text style={[S.label, { flex: 2 }]}>Score</Text>
          <Text style={[S.label, { flex: 1, textAlign: "right" }]}>Weight</Text>
          <Text style={[S.label, { flex: 1, textAlign: "right" }]}>Points</Text>
        </View>
        {dimensionScores.sort((a, b) => b.weight - a.weight).map((d, i) => (
          <View key={d.dimension} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={{ flex: 3, fontSize: 8 }}>{d.dimension.replace(/_/g, " ")}</Text>
            <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={S.barBg}>
                <View style={[
                  d.rawScore >= 0.8 ? S.barFillGreen : d.rawScore >= 0.5 ? S.barFillYellow : S.barFillRed,
                  { width: `${Math.round(d.rawScore * 100)}%` },
                ]} />
              </View>
              <Text style={S.small}>{Math.round(d.rawScore * 100)}%</Text>
            </View>
            <Text style={[S.small, { flex: 1, textAlign: "right" }]}>×{d.weight}</Text>
            <Text style={[S.small, { flex: 1, textAlign: "right" }]}>{d.weightedPoints.toFixed(1)}</Text>
          </View>
        ))}

        <Text style={[S.small, { marginTop: 8, borderLeftWidth: 2, borderLeftColor: "#e5e5e5", paddingLeft: 6 }]}>
          Probes 1–8 measure coherence and conviction, not truth. The ground truth probe (weight 30) is the only dimension that tests factual accuracy.
        </Text>
      </Page>

      {/* ── Page 2: Claims Overview ── */}
      <Page size="A4" style={S.page}>
        <Text style={S.h2}>Claims Overview ({factualClaims.length} factual)</Text>
        <View style={[S.tableHead, { marginBottom: 0 }]}>
          <Text style={[S.label, { flex: 5 }]}>Claim</Text>
          <Text style={[S.label, { flex: 1, textAlign: "center" }]}>Confidence</Text>
          <Text style={[S.label, { flex: 1, textAlign: "center" }]}>Result</Text>
        </View>
        {factualClaims.map((claim, i) => {
          const survived = claim.survived === 1 ? "passed" : claim.survived === 0 ? "failed" : "partial";
          const badgeStyle = claim.survived === 1 ? S.badgePass : claim.survived === 0 ? S.badgeFail : S.badgePartial;
          return (
            <View key={claim.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={{ flex: 5, fontSize: 8, lineHeight: 1.5 }}>{claim.text}</Text>
              <Text style={[S.small, { flex: 1, textAlign: "center" }]}>
                {claim.statedConfidence != null ? `${claim.statedConfidence}%` : "—"}
              </Text>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={badgeStyle}>{survived}</Text>
              </View>
            </View>
          );
        })}

        {/* Ground truth section */}
        <Text style={[S.h2, S.mt16]}>Ground Truth Checks</Text>
        <Text style={[S.small, S.mb8]}>
          External retrieval results for each factual claim. The only dimension that tests actual accuracy.
        </Text>
        {groundTruthProbes.length === 0 && (
          <Text style={S.small}>No ground truth probes recorded.</Text>
        )}
        {groundTruthProbes.map((probe) => {
          const claim = claims.find(c => c.id === probe.claimId);
          return (
            <View key={probe.id} style={[S.probeCard, S.mb8]}>
              <View style={S.probeHeader}>
                <Text style={{ fontSize: 8, flex: 1 }}>{claim?.text ?? "Unknown claim"}</Text>
                {probe.verdict && (
                  <Text style={verdictBadgeStyle(probe.verdict)}>{probe.verdict.replace(/_/g, " ")}</Text>
                )}
              </View>
              {probe.rationale && (
                <View style={{ padding: 6 }}>
                  <Text style={S.small}>{probe.rationale}</Text>
                </View>
              )}
              {(probe.transcript ?? []).filter(t => t.role === "assistant").map((t, i) => (
                <View key={i} style={{ padding: 6, borderTopWidth: 1, borderTopColor: "#f0f0f0" }}>
                  <Text style={{ fontSize: 7.5, lineHeight: 1.5 }}>{t.content}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </Page>

      {/* ── Pages 3+: Probe Transcripts ── */}
      {factualClaims.map((claim) => {
        const cp = batteryProbes.filter(p => p.claimId === claim.id && p.transcript?.length);
        if (!cp.length) return null;
        return (
          <Page key={claim.id} size="A4" style={S.page}>
            <Text style={S.h2}>Probe Transcripts</Text>
            <View style={{ borderLeftWidth: 2, borderLeftColor: "#e5e5e5", paddingLeft: 8, marginBottom: 12 }}>
              <Text style={[S.label, S.mb2]}>Claim</Text>
              <Text style={{ fontSize: 8.5, lineHeight: 1.5 }}>{claim.text}</Text>
            </View>
            {cp.map(probe => (
              <ProbeSection
                key={probe.id}
                probe={probe}
                interrogatorModel={audit.interrogatorModel}
                targetModel={audit.targetModel}
              />
            ))}
          </Page>
        );
      })}

      {/* Response-level probes (no claimId) */}
      {(() => {
        const rp = batteryProbes.filter(p => !p.claimId && p.transcript?.length);
        if (!rp.length) return null;
        return (
          <Page size="A4" style={S.page}>
            <Text style={S.h2}>Response-Level Probe Transcripts</Text>
            {rp.map(probe => (
              <ProbeSection
                key={probe.id}
                probe={probe}
                interrogatorModel={audit.interrogatorModel}
                targetModel={audit.targetModel}
              />
            ))}
          </Page>
        );
      })()}
    </Document>
  );
}
