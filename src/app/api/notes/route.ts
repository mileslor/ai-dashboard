import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const WS = path.join(HOME, "workspace");

const NOTE_DEFS = [
  { id: "seed-note-pilot-direction",  filePath: path.join(WS, "pilot", "PRODUCT_DIRECTION.md"),                   title: "PilotLog — Product Direction",       tags: ["pilot", "product"],          projectId: "seed-pilot",            date: "2026-04-12" },
  { id: "seed-note-thyc-features",    filePath: path.join(WS, "thyc_system", "功能清單及工作細明_20260418.md"),     title: "THYC 功能清單及工作細明",           tags: ["thyc", "features"],          projectId: "seed-thyc_system",      date: "2026-04-18" },
  { id: "seed-note-thyc-spec",        filePath: path.join(WS, "thyc_system", "THYC_CRM_系統功能及規格說明書_v1.0.md"), title: "THYC CRM 規格說明書 v1.0",       tags: ["thyc", "spec"],              projectId: "seed-thyc_system",      date: "2026-04-17" },
  { id: "seed-note-thyc-billing",     filePath: path.join(WS, "thyc_system", "工作進度及收費記錄報告_20260417.md"), title: "THYC 工作進度及收費記錄報告",      tags: ["thyc", "billing"],           projectId: "seed-thyc_system",      date: "2026-04-17" },
  { id: "seed-note-thyc-security",    filePath: path.join(WS, "thyc_system", "安全保護記錄.md"),                   title: "THYC 安全保護記錄",               tags: ["thyc", "security"],          projectId: "seed-thyc_system",      date: "2026-04-17" },
  { id: "seed-note-token-monitor",    filePath: path.join(WS, "token-monitor", "SPEC.md"),                        title: "Token Monitor — 規格",            tags: ["token-monitor", "spec"],     projectId: "seed-token-monitor",    date: "2026-04-01" },
  { id: "seed-note-youtube-lofi",     filePath: path.join(WS, "youtube-lofi-music.md"),                           title: "YouTube Lo-Fi — 第一階段完成記錄", tags: ["youtube-lofi", "music"],     projectId: "seed-youtube-lofi",     date: "2026-04-17" },
  { id: "seed-note-nintendo-research",filePath: path.join(WS, "nintendo_2026_research.md"),                       title: "Nintendo Switch 2026 遊戲研究",   tags: ["nintendo", "gaming"],        projectId: "seed-nintendo-research", date: "2026-04-30" },
  { id: "seed-note-nintendo-exclusives",filePath: path.join(WS, "nintendo_exclusives.md"),                        title: "Nintendo Switch 獨佔遊戲列表",    tags: ["nintendo", "gaming"],        projectId: "seed-nintendo-research", date: "2026-04-30" },
];

const NOTES_DIR = path.join(HOME, "workspace", "notes");

interface DirNote { id: string; filePath: string; title: string; tags: string[]; projectId: string | null; date: string; _projectName: string | null }

function notesFromDir(): DirNote[] {
  if (!fs.existsSync(NOTES_DIR)) return [];
  return fs.readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const filePath = path.join(NOTES_DIR, f);
      const content = fs.readFileSync(filePath, "utf8");
      const titleMatch = content.match(/^# (.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : f.replace(".md", "");
      const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
      const projectMatch = content.match(/\*\*項目：\*\* (.+)/);
      const tagsMatch = content.match(/\*\*Tags：\*\* (.+)/);
      return {
        id: `note-dir-${f.replace(".md", "")}`,
        filePath,
        title,
        tags: tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()) : ["session"],
        projectId: null as string | null,
        date: dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10),
        _projectName: projectMatch ? projectMatch[1].trim() : null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Map project name → seed ID
const PROJECT_NAME_MAP: Record<string, string> = {
  "AI Dashboard": "seed-ai-dashboard",
  "THYC": "seed-thyc_system",
  "KaraQueue": "seed-karaqueue",
  "PilotLog": "seed-pilot",
  "VisaPath": "seed-visapath",
  "Token Monitor": "seed-token-monitor",
  "YouTube Lo-Fi": "seed-youtube-lofi",
  "Nintendo": "seed-nintendo-research",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filterProject = url.searchParams.get("projectId");

  // Static notes
  const staticNotes = NOTE_DEFS
    .filter((n) => !filterProject || n.projectId === filterProject)
    .filter((n) => fs.existsSync(n.filePath))
    .map((n) => {
      const content = fs.readFileSync(n.filePath, "utf8");
      const preview = content.replace(/^#+ .+\n/gm, "").replace(/\|.+\|/g, "").replace(/[-*`]/g, "").trim().slice(0, 200);
      return { id: n.id, title: n.title, tags: n.tags, projectId: n.projectId, date: n.date, preview, contentLength: content.length };
    });

  // Dynamic notes from ~/workspace/notes/
  const dirNotes = notesFromDir()
    .map((n: DirNote) => {
      const resolvedProjectId = n._projectName ? (PROJECT_NAME_MAP[n._projectName] ?? null) : null;
      if (filterProject && resolvedProjectId !== filterProject) return null;
      const content = fs.readFileSync(n.filePath, "utf8");
      const preview = content.replace(/^#+ .+\n/gm, "").replace(/\|.+\|/g, "").replace(/[-*`]/g, "").trim().slice(0, 200);
      return { id: n.id, title: n.title, tags: n.tags, projectId: resolvedProjectId, date: n.date, preview, contentLength: content.length };
    })
    .filter(Boolean);

  const notes = [...dirNotes, ...staticNotes];
  return NextResponse.json({ notes });
}
