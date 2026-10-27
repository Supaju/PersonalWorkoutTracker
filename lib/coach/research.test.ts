import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

vi.hoisted(() => { process.env.DATABASE_URL ??= "file:./test.db"; }); // prisma/test.db; never dev.db
const create = vi.fn();
const parse = vi.fn();
vi.mock("./anthropic", () => ({ getAnthropic: () => ({ messages: { create: (...a: unknown[]) => create(...a), parse: (...a: unknown[]) => parse(...a) } }) }));

import { runResearch } from "./research";
import { research } from "./engine";

const searchResult = (url: string, title: string) => ({ type: "web_search_result", url, title, encrypted_content: "x", page_age: null });
const webResponse = {
  stop_reason: "end_turn",
  content: [
    { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "knee step-up" } },
    {
      type: "web_search_tool_result", tool_use_id: "s1",
      content: [searchResult("https://acsm.org/a", "ACSM position"), searchResult("https://pubmed.ncbi.nlm.nih.gov/1", "Review")],
    },
    { type: "web_search_tool_result", tool_use_id: "s2", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
    {
      type: "text", text: "Lower the box height.",
      citations: [{ type: "web_search_result_location", url: "https://nsca.com/b", title: "NSCA", cited_text: "", encrypted_index: "" }],
    },
  ],
};
const parsed = (over = {}) => ({
  parsed_output: {
    summary: "Box height matters.", applicationToClient: "Use a 6 in box.", confidence: "moderate", seeDoctor: false,
    sources: [
      { title: "ACSM position", url: "https://acsm.org/a" },
      { title: "NSCA", url: "https://nsca.com/b" },
      { title: "Made up", url: "https://invented.example/z" },
    ],
    ...over,
  },
});

describe("runResearch", () => {
  let db: typeof import("@/lib/db").db;
  let on = "", off = "";
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    on = (await db.client.create({ data: { name: "r-on", persona: "calm", webResearch: true } })).id;
    off = (await db.client.create({ data: { name: "r-off", persona: "calm", webResearch: false } })).id;
  });
  afterAll(async () => {
    await db.client.deleteMany({ where: { id: { in: [on, off] } } });
    await db.$disconnect();
  });
  beforeEach(() => { create.mockReset(); parse.mockReset(); });

  it("extracts sources, tolerates an error result, drops sources the search never returned, flags medical", async () => {
    create.mockResolvedValue(webResponse);
    parse.mockResolvedValue(parsed());
    const r = await runResearch(on, "His knees ache on step-ups, what should we change?");
    expect(r.searched).toBe(true);
    expect(create.mock.calls[0][0].tools[0]).toMatchObject({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
    // the structured call was offered exactly the returned URLs
    expect(parse.mock.calls[0][0].messages[0].content).toContain("https://nsca.com/b");
    expect(r.note.sources.map((s) => s.url)).toEqual(["https://acsm.org/a", "https://nsca.com/b"]);
    expect(r.note.seeDoctor).toBe(true);
    expect(r.note.applicationToClient).toMatch(/doctor/);
    const row = await db.researchNote.findUniqueOrThrow({ where: { id: r.researchNoteId } });
    expect(JSON.parse(row.sources)).toHaveLength(2);
    expect(row.clientId).toBe(on);
  });

  it("re-sends on pause_turn", async () => {
    create
      .mockResolvedValueOnce({ stop_reason: "pause_turn", content: webResponse.content.slice(0, 2) })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "done" }] });
    parse.mockResolvedValue(parsed({ sources: [] }));
    const r = await runResearch(on, "How much protein?");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages.at(-1).role).toBe("assistant");
    expect(r.note.seeDoctor).toBe(false);
  });

  it("disabled: no tools, 'No web research was run' note is stored, via engine.research", async () => {
    parse.mockResolvedValue(parsed());
    const r = await research(off, "How much protein?");
    expect(create).not.toHaveBeenCalled();
    expect(r.searched).toBe(false);
    expect(r.note.sources).toEqual([]);
    expect(r.note.summary.startsWith("No web research was run (disabled for this client).")).toBe(true);
    const row = await db.researchNote.findUniqueOrThrow({ where: { id: r.researchNoteId as string } });
    expect(row.summary.startsWith("No web research was run (disabled for this client).")).toBe(true);
    expect(row.sources).toBe("[]");
  });
});
