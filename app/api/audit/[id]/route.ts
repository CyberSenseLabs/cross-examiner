import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audits, claims, probes, dimensionScores } from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [audit] = await db.select().from(audits).where(eq(audits.id, id));
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const claimRows = await db.select().from(claims).where(eq(claims.auditId, id));
  const probeRows = await db.select().from(probes).where(eq(probes.auditId, id));
  const dimRows = await db.select().from(dimensionScores).where(eq(dimensionScores.auditId, id));

  return NextResponse.json({ audit, claims: claimRows, probes: probeRows, dimensionScores: dimRows });
}
