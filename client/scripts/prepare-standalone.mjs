import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, "..");
const nextDir = path.join(clientRoot, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");
const staticSourceDir = path.join(nextDir, "static");
const staticTargetDir = path.join(standaloneNextDir, "static");
const publicSourceDir = path.join(clientRoot, "public");
const publicTargetDir = path.join(standaloneDir, "public");

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(sourceDir, targetDir) {
  await rm(targetDir, { force: true, recursive: true });
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
}

async function main() {
  if (!(await pathExists(standaloneDir))) {
    throw new Error(
      "Missing standalone build output at .next/standalone. Run `npm run build` before starting the production server.",
    );
  }

  if (!(await pathExists(staticSourceDir))) {
    throw new Error(
      "Missing Next static assets at .next/static. Re-run `npm run build` to regenerate the standalone bundle.",
    );
  }

  await copyDirectory(staticSourceDir, staticTargetDir);

  if (await pathExists(publicSourceDir)) {
    await copyDirectory(publicSourceDir, publicTargetDir);
  }

  console.log("Standalone assets prepared in .next/standalone");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
