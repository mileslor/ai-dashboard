import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Find the main Electron process running token-monitor
    const pid = execSync(
      `ps aux | grep "Electron.app/Contents/MacOS/Electron" | grep "token-monitor" | grep -v "Helper" | grep -v grep | awk '{print $2}' | head -1`,
      { encoding: "utf8" }
    ).trim();

    if (pid) {
      // Use AppleScript to bring window to front
      execSync(
        `osascript -e 'tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true'`
      );
      return NextResponse.json({ ok: true, pid });
    }

    // Not running — start it
    execSync(`cd ~/workspace/token-monitor && npm start &`, { shell: "/bin/zsh", detached: true } as never);
    return NextResponse.json({ ok: true, started: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
