export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import CurrentProgram from "@/components/program/CurrentProgram";
import WeekStrip from "@/components/program/WeekStrip";
import VersionHistory from "@/components/program/VersionHistory";
import Proposals, { type ProposalRow } from "@/components/program/Proposals";
import ResearchNotes, { type Note } from "@/components/program/ResearchNotes";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export default async function ProgramPage() {
  const clientId = await getClientId();
  const [client, versions, proposals, notes] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { trainingDays: true } }),
    db.programVersion.findMany({ where: { clientId }, orderBy: { version: "desc" } }),
    db.programProposal.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    db.researchNote.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
  ]);
  const current = versions.find((v) => !v.endDate) ?? null;
  let trainingDays: number[] = [];
  try { trainingDays = JSON.parse(client.trainingDays); } catch { /* none */ }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold uppercase tracking-wide">Program</h1>
      <Proposals
        proposals={proposals.map((p) => ({
          id: p.id, status: p.status as ProposalRow["status"], observations: p.observations, recommendation: p.recommendation,
          rationale: p.rationale, tradeOffs: p.tradeOffs, weekToWeek: p.weekToWeek, structure: p.structure,
          clientResponse: p.clientResponse, createdAt: p.createdAt.toISOString(), decidedAt: iso(p.decidedAt),
        }))}
      />
      <CurrentProgram
        version={current && { version: current.version, phase: current.phase, reason: current.reason, startDate: current.startDate, structure: current.structure }}
        trainingDays={trainingDays}
      />
      <WeekStrip />
      <VersionHistory versions={versions.map((v) => ({ version: v.version, phase: v.phase, reason: v.reason, startDate: v.startDate, endDate: v.endDate }))} />
      <ResearchNotes
        notes={notes.map((n) => ({
          id: n.id, question: n.question, summary: n.summary, applicationToClient: n.applicationToClient,
          confidence: n.confidence as Note["confidence"], sources: n.sources, createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
