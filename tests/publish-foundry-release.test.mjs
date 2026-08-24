import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  buildReleasePayload,
  FOUNDRY_RELEASE_API,
  publishFoundryRelease,
} from "../tools/publish-foundry-release.mjs";

const manifest = {
  id: "deadlands-classic",
  version: "0.4.1",
  url: "https://github.com/Chorss/deadlands-classic-fvtt",
  compatibility: {
    minimum: "14",
    verified: "14.367",
  },
};

function response(status, data, headers = {}) {
  return new Response(data === undefined ? "" : JSON.stringify(data), { status, headers });
}

describe("Foundry package release publication", () => {
  let directory;
  let manifestPath;

  before(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "foundry-release-test-"));
    manifestPath = path.join(directory, "system.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
  });

  after(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("builds versioned manifest and release-notes URLs from system.json data", () => {
    assert.deepEqual(buildReleasePayload(manifest), {
      id: "deadlands-classic",
      release: {
        version: "0.4.1",
        manifest:
          "https://github.com/Chorss/deadlands-classic-fvtt/releases/download/0.4.1/system.json",
        notes: "https://github.com/Chorss/deadlands-classic-fvtt/releases/tag/0.4.1",
        compatibility: {
          minimum: "14",
          verified: "14.367",
        },
      },
    });
  });

  it("sends a dry run with the token only in the Authorization header", async () => {
    let request;
    const logs = [];
    const result = await publishFoundryRelease({
      manifestPath,
      dryRun: true,
      token: "fvttp_secret",
      log: (message) => logs.push(message),
      fetchImpl: async (url, options) => {
        request = { url, options };
        return response(200, { status: "success", message: "Dry run completed successfully" });
      },
    });

    assert.equal(result.status, "success");
    assert.equal(request.url, FOUNDRY_RELEASE_API);
    assert.equal(request.options.headers.Authorization, "fvttp_secret");
    const payload = JSON.parse(request.options.body);
    assert.equal(payload["dry-run"], true);
    assert.doesNotMatch(request.url, /fvttp_secret/);
    assert.doesNotMatch(request.options.body, /fvttp_secret/);
    assert.doesNotMatch(logs.join("\n"), /fvttp_secret/);
  });

  it("accepts a successful publication response", async () => {
    const result = await publishFoundryRelease({
      manifestPath,
      token: "token",
      log: () => {},
      fetchImpl: async () => response(200, { status: "success", page: "https://example.test" }),
    });

    assert.equal(result.status, "success");
    assert.equal(result.payload["dry-run"], undefined);
  });

  it("rejects an unsuccessful API response", async () => {
    await assert.rejects(
      publishFoundryRelease({
        manifestPath,
        token: "token",
        log: () => {},
        fetchImpl: async () =>
          response(400, {
            status: "error",
            errors: { manifest: [{ message: "Enter a valid URL.", code: "invalid" }] },
          }),
      }),
      /HTTP 400.*invalid/
    );
  });

  it("requires the package release secret", async () => {
    await assert.rejects(
      publishFoundryRelease({ manifestPath, token: "", log: () => {} }),
      /FOUNDRY_PACKAGE_RELEASE_TOKEN is required/
    );
  });

  it("retries HTTP 429 after the Retry-After delay", async () => {
    let calls = 0;
    const delays = [];
    const result = await publishFoundryRelease({
      manifestPath,
      token: "token",
      log: () => {},
      sleep: async (delay) => delays.push(delay),
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return response(429, { status: "error" }, { "Retry-After": "2" });
        }
        return response(200, { status: "success" });
      },
    });

    assert.equal(calls, 2);
    assert.deepEqual(delays, [2000]);
    assert.equal(result.status, "success");
  });

  it("treats a duplicate version publication as already completed", async () => {
    const result = await publishFoundryRelease({
      manifestPath,
      token: "token",
      log: () => {},
      fetchImpl: async () =>
        response(400, {
          status: "error",
          errors: {
            __all__: [
              {
                message: "Package Version with this Package and Version Number already exists.",
                code: "unique_together",
              },
            ],
          },
        }),
    });

    assert.equal(result.status, "already-published");
  });

  it("keeps a rerun idempotent when the dry run also reports the existing version", async () => {
    const result = await publishFoundryRelease({
      manifestPath,
      dryRun: true,
      token: "token",
      log: () => {},
      fetchImpl: async () =>
        response(400, {
          status: "error",
          errors: { __all__: [{ code: "unique_together" }] },
        }),
    });

    assert.equal(result.status, "already-published");
  });
});
