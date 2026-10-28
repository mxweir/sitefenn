import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

let current: ChildProcess | undefined;
export const speechAvailable =
  process.platform === "darwin" && existsSync("/usr/bin/say");
export function stopSpeech() {
  current?.kill("SIGTERM");
  current = undefined;
}
export function speak(text: string) {
  if (!speechAvailable)
    throw new Error(
      "Lokale Sprachausgabe ist auf dieser Plattform nicht eingerichtet.",
    );
  if (!text.trim() || text.length > 5000)
    throw new Error("Zum Vorlesen 1–5000 Zeichen wählen.");
  stopSpeech();
  const child = spawn("/usr/bin/say", ["-v", "Anna", "-r", "170"], {
    stdio: ["pipe", "ignore", "ignore"],
  });
  current = child;
  const timer = setTimeout(() => child.kill("SIGTERM"), 180_000);
  child.once("exit", () => {
    clearTimeout(timer);
    if (current === child) current = undefined;
  });
  child.once("error", () => {
    clearTimeout(timer);
    if (current === child) current = undefined;
  });
  // User/model text is stdin only, never a shell command or executable argument.
  child.stdin?.on("error", () => {});
  child.stdin?.end(
    text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""),
  );
}
