import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/db";
import { audits, claims, probes, dimensionScores } from "@/db/schema";
import { AuditReportDocument } from "@/lib/pdf-report";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [audit] = await db.select().from(audits).where(eq(audits.id, id));
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (audit.status !== "complete") {
    return NextResponse.json({ error: "Audit not complete" }, { status: 400 });
  }

  const claimRows = await db.select().from(claims).where(eq(claims.auditId, id));
  const probeRows = await db.select().from(probes).where(eq(probes.auditId, id));
  const dimRows = await db.select().from(dimensionScores).where(eq(dimensionScores.auditId, id));

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(AuditReportDocument, {
      audit: audit as any,
      claims: claimRows as any,
      probes: probeRows as any,
      dimensionScores: dimRows,
    }) as any,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="audit-${id.slice(0, 8)}.pdf"`,
    },
  });
}
