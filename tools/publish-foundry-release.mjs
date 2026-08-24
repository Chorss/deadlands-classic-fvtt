#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FOUNDRY_RELEASE_API = "https://foundryvtt.com/_api/packages/release_version/";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`system.json must define a non-empty ${field}`);
  }
  return value;
}

function repositoryFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("GITHUB_REPOSITORY is unset and system.json url is not a valid URL");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parsed.hostname !== "github.com" || parts.length < 2) {
    throw new Error(
      "GITHUB_REPOSITORY is unset and system.json url is not a GitHub repository URL"
    );
  }
  return `${parts[0]}/${parts[1]}`;
}

export function buildReleasePayload(manifest, { repository, dryRun = false } = {}) {
  const id = requireString(manifest.id, "id");
  const version = requireString(manifest.version, "version");
  const compatibility = manifest.compatibility;
  if (!compatibility || typeof compatibility !== "object" || Array.isArray(compatibility)) {
    throw new Error("system.json must define compatibility");
  }

  const githubRepository = repository || repositoryFromUrl(requireString(manifest.url, "url"));
  const releaseUrl = `https://github.com/${githubRepository}/releases`;
  const payload = {
    id,
    release: {
      version,
      manifest: `${releaseUrl}/download/${version}/system.json`,
      notes: `${releaseUrl}/tag/${version}`,
      compatibility: { ...compatibility },
    },
  };

  if (dryRun) {
    payload["dry-run"] = true;
  }
  return payload;
}

function retryAfterMilliseconds(value, now = Date.now()) {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return null;
  }
  return Math.max(0, date - now);
}

function isDuplicateVersion(data) {
  const errors = data?.errors;
  if (!errors || typeof errors !== "object") {
    return false;
  }

  const entries = Object.values(errors).flatMap((value) => (Array.isArray(value) ? value : []));
  return entries.length > 0 && entries.every((entry) => entry?.code === "unique_together");
}

async function parseResponse(response) {
  const text = await response.text();
  if (text === "") {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Foundry API returned non-JSON response (HTTP ${response.status})`);
  }
}

async function requestWithRetry({ apiUrl, token, payload, fetchImpl, sleep, maxRetries, log }) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 429) {
      return response;
    }
    if (attempt >= maxRetries) {
      throw new Error(`Foundry API rate limit persisted after ${maxRetries} retries`);
    }

    const retryAfter = response.headers.get("retry-after");
    const delay = retryAfterMilliseconds(retryAfter);
    if (delay === null) {
      throw new Error("Foundry API returned HTTP 429 without a valid Retry-After header");
    }
    log(`Foundry API rate limit reached; retrying after ${Math.ceil(delay / 1000)}s`);
    await sleep(delay);
  }
}

export async function publishFoundryRelease({
  manifestPath = "system.json",
  repository,
  dryRun = false,
  token = process.env.FOUNDRY_PACKAGE_RELEASE_TOKEN,
  apiUrl = FOUNDRY_RELEASE_API,
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxRetries = 3,
  log = console.log,
} = {}) {
  if (!token) {
    throw new Error("FOUNDRY_PACKAGE_RELEASE_TOKEN is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A Fetch API implementation is required");
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const payload = buildReleasePayload(manifest, { repository, dryRun });
  log(`${dryRun ? "Validating" : "Publishing"} ${payload.id} ${payload.release.version}`);

  const response = await requestWithRetry({
    apiUrl,
    token,
    payload,
    fetchImpl,
    sleep,
    maxRetries,
    log,
  });
  const data = await parseResponse(response);
  if (isDuplicateVersion(data)) {
    log(`${payload.id} ${payload.release.version} is already published; nothing to do`);
    return { status: "already-published", data, payload };
  }
  if (!response.ok || data?.status !== "success") {
    const detail = data === null ? "empty response" : JSON.stringify(data);
    throw new Error(`Foundry API request failed (HTTP ${response.status}): ${detail}`);
  }

  log(`Foundry API ${dryRun ? "dry run" : "publication"} succeeded`);
  return { status: "success", data, payload };
}

async function main() {
  const args = process.argv.slice(2);
  const knownArgs = new Set(["--dry-run"]);
  const unknown = args.filter((arg) => !knownArgs.has(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  }
  await publishFoundryRelease({
    dryRun: args.includes("--dry-run"),
    repository: process.env.GITHUB_REPOSITORY,
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Foundry publication failed: ${error.message}`);
    process.exitCode = 1;
  });
}
