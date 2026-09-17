import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

const windowsPython = "C:\\ProgramData\\anaconda3\\envs\\AI_group\\python.exe";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const candidates = process.platform === "win32" && await exists(windowsPython)
  ? [windowsPython]
  : [process.env.PYTHON, "python3", "python"].filter(Boolean);

const script = process.argv[2] ?? "scripts/generate_book_data.py";

async function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [script], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

let lastError;
for (const candidate of candidates) {
  try {
    await run(candidate);
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

throw lastError ?? new Error("No Python interpreter was found.");
