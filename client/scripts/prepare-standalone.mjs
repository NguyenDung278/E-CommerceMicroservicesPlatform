import { access, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, "..");
const nextDir = path.join(clientRoot, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const staticSourceDir = path.join(nextDir, "static");
const publicSourceDir = path.join(clientRoot, "public");

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

async function findStandaloneServerEntries(currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const matches = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      matches.push(...(await findStandaloneServerEntries(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name === "server.js") {
      matches.push(entryPath);
    }
  }

  return matches;
}

async function resolveStandaloneRuntimeRoot() {
  const serverEntries = await findStandaloneServerEntries(standaloneDir);

  if (serverEntries.length === 0) {
    throw new Error(
      "Missing standalone server entry at .next/standalone. Re-run `npm run build` to regenerate the production bundle.",
    );
  }

  serverEntries.sort((left, right) => {
    const leftDepth = path.relative(standaloneDir, left).split(path.sep).length;
    const rightDepth = path.relative(standaloneDir, right).split(path.sep).length;
    return leftDepth - rightDepth;
  });

  return {
    runtimeRoot: path.dirname(serverEntries[0]),
    serverEntry: serverEntries[0],
  };
}

async function ensureStandaloneLauncher(serverEntry) {
  const launcherPath = path.join(standaloneDir, "server.js");
  const relativeServerEntry = path
    .relative(standaloneDir, serverEntry)
    .split(path.sep)
    .join("/");

  if (relativeServerEntry === "server.js") {
    return;
  }

  const launcherSource = `require("./${relativeServerEntry}");\n`;
  await writeFile(launcherPath, launcherSource, "utf8");
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

  const { runtimeRoot, serverEntry } = await resolveStandaloneRuntimeRoot();
  const staticTargetDir = path.join(runtimeRoot, ".next", "static");
  const publicTargetDir = path.join(runtimeRoot, "public");

  await copyDirectory(staticSourceDir, staticTargetDir);

  if (await pathExists(publicSourceDir)) {
    await copyDirectory(publicSourceDir, publicTargetDir);
  }

  await ensureStandaloneLauncher(serverEntry);

  console.log("Standalone assets prepared in .next/standalone");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
