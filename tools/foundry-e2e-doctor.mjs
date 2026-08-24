#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { getFoundryE2EConfig } from "./foundry-e2e-config.mjs";

const config = getFoundryE2EConfig();
const errors = [];
const notes = [];

async function readJson(file, label) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${label}: cannot read valid JSON at ${file} (${error.message})`);
    return null;
  }
}

async function checkFile(file, label, mode = fsConstants.R_OK) {
  try {
    await fs.access(file, mode);
    return true;
  } catch {
    errors.push(`${label}: missing or inaccessible at ${file}`);
    return false;
  }
}

async function probeServer() {
  try {
    const response = await fetch(`${config.baseURL}/join`, { redirect: "follow" });
    if (!response.ok) {
      errors.push(`running Foundry returned HTTP ${response.status} for ${config.baseURL}/join`);
      return false;
    }
    const html = await response.text();
    if (!response.url.endsWith("/join")) {
      errors.push(
        `port ${config.port} is occupied, but Foundry is not serving the launched world (/join redirected to ${response.url})`
      );
      return true;
    }
    if (html.includes("There is currently no active game session")) {
      errors.push(
        `Foundry is running on port ${config.port}, but no world is active; launch ${config.world} or stop Foundry so Playwright can start it`
      );
      return true;
    }
    const world = await readJson(path.join(config.worldPath, "world.json"), "world manifest");
    if (world && !html.includes(`<title>${world.title}`)) {
      errors.push(
        `running Foundry on ${config.baseURL} is not world ${config.world} (${world.title})`
      );
    }
    notes.push("Foundry is already running; Playwright will reuse it and leave it running.");
    await inspectUsersInBrowser();
    return true;
  } catch {
    notes.push(
      "Foundry is stopped; Playwright will start deadlands-test and stop only that process."
    );
    return false;
  }
}

function validateUsers(users, { passwordsVerified = false } = {}) {
  const gm = users.find((user) => user.name === config.gmUser);
  if (!gm || Number(gm.role) !== 4) {
    errors.push(`world must contain Gamemaster user "${config.gmUser}"`);
  } else if (passwordsVerified && !gm.passwordless) {
    errors.push(`Gamemaster user "${config.gmUser}" must be passwordless for local E2E`);
  }

  const player = users.find((user) => user.name === config.playerUser);
  if (!player) {
    notes.push(
      `Player user "${config.playerUser}" is absent and will be created passwordless by the race test.`
    );
  } else if (Number(player.role) !== 1) {
    errors.push(`Player user "${config.playerUser}" must have the Player role`);
  } else if (passwordsVerified && !player.passwordless) {
    errors.push(
      `existing Player user "${config.playerUser}" has a password; E2E will not change it`
    );
  }
}

async function verifyPasswordlessLogin(page, user) {
  const response = await page.request.post(`${config.baseURL}/join`, {
    form: { action: "join", userId: user.id, password: "" },
  });
  if (!response.ok()) {
    errors.push(
      `${user.name} user "${user.name}" must be passwordless for local E2E (HTTP ${response.status()})`
    );
  }
  // A GET using the same cookie immediately clears the short-lived diagnostic
  // world session, so a reused server is left as it was found.
  await page.request.get(`${config.baseURL}/join`);
}

async function inspectUsersInBrowser() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${config.baseURL}/join`);
    await page.waitForFunction(() => globalThis.game?.users?.size > 0);
    const users = await page.evaluate(() =>
      game.users.map((user) => ({ id: user.id, name: user.name, role: user.role }))
    );
    validateUsers(users);
    const gm = users.find((user) => user.name === config.gmUser && Number(user.role) === 4);
    const player = users.find((user) => user.name === config.playerUser);
    if (gm) {
      await verifyPasswordlessLogin(page, gm);
    }
    if (player) {
      await verifyPasswordlessLogin(page, player);
    }
  } catch (error) {
    errors.push(`could not inspect users in the running world (${error.message})`);
  } finally {
    await browser?.close();
  }
}

async function inspectUsersOffline() {
  const usersPath = path.join(config.worldPath, "data", "users");
  const classicLevelModule = path.join(config.appRoot, "node_modules", "classic-level", "index.js");
  try {
    const { ClassicLevel } = await import(pathToFileURL(classicLevelModule));
    const { testPassword } = await import(
      pathToFileURL(path.join(config.appRoot, "dist", "core", "auth.mjs"))
    );
    const database = new ClassicLevel(usersPath, { valueEncoding: "json" });
    await database.open();
    const users = [];
    for await (const value of database.values()) {
      users.push({
        ...value,
        passwordless: testPassword("", value.password, value.passwordSalt),
      });
    }
    await database.close();
    validateUsers(users, { passwordsVerified: true });
  } catch (error) {
    errors.push(`could not inspect world users at ${usersPath} (${error.message})`);
  }
}

function validateManifests(foundryPackage, systemManifest, worldManifest) {
  if (worldManifest?.id !== config.world) {
    errors.push(`FOUNDRY_WORLD must resolve to world id "${config.world}"`);
  }
  if (worldManifest?.system !== config.systemId) {
    errors.push(
      `world ${config.world} uses ${worldManifest?.system ?? "no system"}, expected ${config.systemId}`
    );
  }

  const installedBuild = foundryPackage?.release
    ? `${foundryPackage.release.generation}.${foundryPackage.release.build}`
    : null;
  if (installedBuild !== systemManifest?.compatibility?.verified) {
    errors.push(
      `Foundry build ${installedBuild ?? "unknown"} does not match system.json compatibility.verified ${systemManifest?.compatibility?.verified}`
    );
  }
  if (foundryPackage?.version && foundryPackage.version !== "14.367.0") {
    errors.push(`Foundry package version is ${foundryPackage.version}; local E2E targets 14.367.0`);
  }
  return installedBuild;
}

async function validateSystemLink() {
  const systemLink = path.join(config.dataPath, "Data", "systems", config.systemId);
  try {
    const linkStat = await fs.lstat(systemLink);
    if (!linkStat.isSymbolicLink()) {
      errors.push(`${systemLink} must be a symlink to this repository`);
      return;
    }
    const target = await fs.realpath(systemLink);
    if (target !== config.repoRoot) {
      errors.push(`${systemLink} resolves to ${target}, expected ${config.repoRoot}`);
    }
  } catch (error) {
    errors.push(`system symlink is missing or broken at ${systemLink} (${error.message})`);
  }
}

async function run() {
  await checkFile(config.executable, "FOUNDRY_EXECUTABLE", fsConstants.X_OK);
  await checkFile(config.mainScript, "Foundry Node entry point");
  await checkFile(config.nodeShim, "Foundry headless Node preload");
  const foundryPackage = await readJson(
    path.join(config.appRoot, "package.json"),
    "Foundry package"
  );
  const systemManifest = await readJson(
    path.join(config.repoRoot, "system.json"),
    "system manifest"
  );
  const worldManifest = await readJson(path.join(config.worldPath, "world.json"), "world manifest");
  const installedBuild = validateManifests(foundryPackage, systemManifest, worldManifest);
  await validateSystemLink();

  await checkFile(chromium.executablePath(), "Playwright Chromium", fsConstants.X_OK);

  const running = await probeServer();
  if (!running) {
    await inspectUsersOffline();
  }

  if (errors.length) {
    console.error("Foundry E2E doctor failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Foundry E2E doctor passed: ${installedBuild}, world ${config.world}, ${config.baseURL}`
  );
  for (const note of notes) {
    console.log(`- ${note}`);
  }
}

await run();
