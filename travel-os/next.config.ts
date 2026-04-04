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
};

export default nextConfig;
