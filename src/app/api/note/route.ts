import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const NOTES_DIR = path.join(HOME, "workspace", "notes");
const CONV_LOG = path.join(HOME, ".claude", "conversation-log.md");

// POST /api/note
// Body: { title, content, project?, date?, ai?, log? }
// - title: note title
// - content: full markdown content (optional, will build from fields if omitted)
// - project: project name (optional)
// - date: YYYY-MM-DD (optional, defaults to today)
// - ai: "mx" | "ce" | "user" (optional, defaults to "mx")
// - log: one-line summary to append to conversation-log.md (optional)
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      title?: string;
      content?: string;
      project?: string;
      date?: string;
      ai?: string;
      log?: string;
    };

    const today = new Date().toISOString().slice(0, 10);
    const date = body.date ?? today;
    const ai = body.ai ?? "mx";
    const title = body.title?.trim() ?? `Session ${date}`;

    // Build filename
    const slug = title.replace(/[^a-zA-Z0-9一-鿿㐀-䶿]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const filename = `${date}-${slug}.md`;
    const filePath = path.join(NOTES_DIR, filename);

    // Build content
    const noteContent = body.content?.trim()
      ? body.content.trim()
      : [
          `# ${title}`,
          "",
          body.project ? `**項目：** ${body.project}` : null,
          `**日期：** ${date}`,
          `**參與：** ${ai === "mx" ? "mx（MiniMax）" : ai === "ce" ? "ce（Claude）" : "User"}`,
          "",
          "---",
          "",
          "*(內容未提供)*",
        ].filter((l) => l !== null).join("\n");

    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(filePath, noteContent, "utf8");

    // Optionally append to conversation-log.md
    if (body.log?.trim()) {
      const logLine = `- [${ai} ${date}]: ${body.log.trim()}`;
      let logContent = fs.existsSync(CONV_LOG) ? fs.readFileSync(CONV_LOG, "utf8") : "# 對話記錄\n";
      const header = `## ${date}`;
      if (logContent.includes(header)) {
        logContent = logContent.replace(new RegExp(`(## ${date}[^\\n]*\\n)`), `$1${logLine}\n`);
      } else {
        logContent = logContent.trimEnd() + `\n\n${header}\n\n${logLine}\n`;
      }
      fs.writeFileSync(CONV_LOG, logContent, "utf8");
    }

    return NextResponse.json({ ok: true, file: filename, path: filePath });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
