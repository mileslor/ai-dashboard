import { NextResponse } from "next/server";
import { execSync, execFileSync } from "child_process";

export const dynamic = "force-dynamic";

const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";

const ENV: NodeJS.ProcessEnv = {
  ...process.env,
  HOME: "/Users/mileslor",
  PATH: "/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
};

function runCronList() {
  const raw = execFileSync(OPENCLAW_BIN, ["cron", "list", "--json"], {
    env: ENV,
    timeout: 10000,
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

// GET /api/openclaw — list cron jobs + gateway status
export async function GET() {
  try {
    const data = runCronList();

    // Check gateway status via a quick list call success
    return NextResponse.json({ ok: true, jobs: data.jobs ?? [] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), jobs: [] }, { status: 200 });
  }
}

// POST /api/openclaw — trigger a job { action: "run", id: "..." }
export async function POST(req: Request) {
  try {
    const { action, id } = await req.json();

    if (action === "run" && id) {
      execFileSync(OPENCLAW_BIN, ["cron", "run", id], {
        env: ENV,
        timeout: 8000,
        encoding: "utf8",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
