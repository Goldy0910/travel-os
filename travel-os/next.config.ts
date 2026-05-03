import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const cwd = process.cwd();
const parentNext = path.join(cwd, "..", "node_modules", "next", "package.json");
const turbopackRoot = fs.existsSync(parentNext)
  ? path.resolve(cwd, "..")
  : cwd;

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  async redirects() {
    return [{ source: "/app/tools/visa2", destination: "/app/tools/visa3", permanent: true }];
  },
};

export default nextConfig;
