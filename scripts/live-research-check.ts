// Live check for criterion 12 (research). Uses the test DB, never dev.db.
// Run: node --env-file=.env.local --import tsx scripts/live-research-check.ts
process.env.DATABASE_URL = "file:./test.db";
import { db } from "@/lib/db";
import { runResearch } from "@/lib/coach/research";
import { DEFAULT_PERSONA } from "@/lib/coach/philosophy";

async function main() {
  const client = await db.client.upsert({
    where: { id: "live-check" },
    create: { id: "live-check", name: "Live Check", persona: DEFAULT_PERSONA },
    update: {},
  });
  for (const webResearch of [true, false]) {
    await db.client.update({ where: { id: client.id }, data: { webResearch } });
    const r = await runResearch(client.id, "His knees ache on step-ups, what should we change?");
    console.log(JSON.stringify({
      webResearch, searched: r.searched, stored: !!r.researchNoteId, seeDoctor: r.note.seeDoctor,
      confidence: r.note.confidence, sources: r.note.sources.map((s) => new URL(s.url).hostname),
      summary: r.note.summary.slice(0, 300), application: r.note.applicationToClient.slice(0, 300),
    }, null, 2));
  }
}
main().finally(() => db.$disconnect());
