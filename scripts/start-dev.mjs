#!/usr/bin/env node
/**
 * Next.js 16 refuses to start a second `next dev` for the same app directory.
 * When port 3000 is still held by a prior Next dev process, `npm run dev` exits with code 1.
 * We stop only listeners whose command line looks like `next` so other apps on the same port stay safe.
 *
 * Set TRAVEL_OS_SKIP_DEV_KILL=1 to disable this behavior.
 */
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const require = createRequire(path.join(projectRoot, "package.json"));
let nextBin;
try {
  nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist/bin/next");
} catch {
  console.error("Could not resolve `next`. Run `npm install` from the repo root.");
  process.exit(1);
}

function parsePortFromArgs(argv) {
  const envPort = process.env.PORT ? Number(process.env.PORT) : NaN;
  if (Number.isFinite(envPort)) return envPort;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-p" || argv[i] === "--port") {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n)) return n;
    }
    const m = /^--port=(\d+)$/.exec(argv[i]);
    if (m) return Number(m[1]);
  }
  return 3000;
}

function killNextListenerOnPort(port) {
  if (process.env.TRAVEL_OS_SKIP_DEV_KILL === "1") return;
  if (process.platform === "win32") return;

  let pids = [];
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
    }).trim();
    pids = out.length ? out.split(/\n/) : [];
  } catch {
    return;
  }

  for (const pid of pids) {
    try {
      const args = execSync(`ps -p ${pid} -o args=`, { encoding: "utf8" });
      if (/\bnext\b/.test(args)) {
        execSync(`kill ${pid}`);
        console.error(`[travel-os] Freed port ${port} (stopped prior Next.js dev, PID ${pid}).`);
      }
    } catch {
      /* ignore */
    }
  }
}

const forwarded = process.argv.slice(2);
const port = parsePortFromArgs(forwarded);
killNextListenerOnPort(port);

const child = spawn(process.execPath, [nextBin, "dev", ...forwarded], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
