import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const aiServiceDirectory = join(backendDirectory, "ai-service");

/** Finds the project-local Python interpreter on Windows or POSIX systems. */
function resolvePythonInterpreter() {
  const localCandidates = [
    join(aiServiceDirectory, ".venv", "Scripts", "python.exe"),
    join(aiServiceDirectory, ".venv", "bin", "python")
  ];

  return localCandidates.find(existsSync) ?? (process.platform === "win32" ? "python" : "python3");
}

/** Runs the worker's non-blocking startup check and forwards its exit status to npm. */
function main() {
  const result = spawnSync(resolvePythonInterpreter(), ["-m", "relay_ai.worker", "--check"], {
    cwd: aiServiceDirectory,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`Unable to start the Relay AI worker: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
