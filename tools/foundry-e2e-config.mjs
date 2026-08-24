import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function expandHome(value) {
  if (value === "~") {
    return os.homedir();
  }
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : path.resolve(value);
}

function defaultDataPath() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "FoundryVTT");
  }
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA ?? os.homedir(), "FoundryVTT");
  }
  return path.join(
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
    "FoundryVTT"
  );
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

export function getFoundryE2EConfig() {
  const executable = expandHome(process.env.FOUNDRY_EXECUTABLE ?? "~/foundryvtt/foundryvtt");
  const dataPath = expandHome(process.env.FOUNDRY_DATA_PATH ?? defaultDataPath());
  const world = process.env.FOUNDRY_WORLD ?? "deadlands-test";
  const port = Number(process.env.FOUNDRY_PORT ?? 30_000);
  const baseURL = process.env.FOUNDRY_URL ?? `http://localhost:${port}`;
  const appRoot = path.join(path.dirname(executable), "resources", "app");
  const mainScript = path.join(appRoot, "main.js");
  const nodeShim = path.join(REPO_ROOT, "tools", "foundry-node-shim.cjs");

  return {
    appRoot,
    baseURL,
    dataPath,
    executable,
    gmUser: process.env.FOUNDRY_GM_USER ?? "Gamemaster",
    mainScript,
    nodeShim,
    playerUser: process.env.FOUNDRY_PLAYER_USER ?? "Player",
    port,
    repoRoot: REPO_ROOT,
    systemId: "deadlands-classic",
    world,
    worldPath: path.join(dataPath, "Data", "worlds", world),
  };
}

export function foundryWebServerCommand(config = getFoundryE2EConfig()) {
  return [
    "ELECTRON_RUN_AS_NODE=1",
    shellQuote(config.executable),
    `--require=${shellQuote(config.nodeShim)}`,
    shellQuote(config.mainScript),
    `--dataPath=${shellQuote(config.dataPath)}`,
    `--world=${shellQuote(config.world)}`,
    `--port=${config.port}`,
    "--noupdate",
    "--noipdiscovery",
    "--noupnp",
  ].join(" ");
}
