import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findBroadPermissionIssues,
  findLocalIdeMcpIssues,
  findPrivatePathIssues,
  findReleaseManifestIssues,
  findTomlIssues,
  findWorkflowReferenceIssues,
} from "../tools/verify-ai-workshop-lib.mjs";

describe("AI workshop validation", () => {
  it("rejects malformed TOML", () => {
    assert.notDeepEqual(findTomlIssues("[sandbox_workspace_write\nnetwork_access = false"), []);
    assert.deepEqual(findTomlIssues("[sandbox_workspace_write]\nnetwork_access = false"), []);
  });

  it("finds private absolute paths", () => {
    assert.equal(findPrivatePathIssues("config", "root = /home/alice/private/repo").length, 1);
    assert.deepEqual(findPrivatePathIssues("config", "root = $DEADLANDS_RULES_PATH"), []);
  });

  it("rejects broad Node, install, Python, and pip permissions", () => {
    const settings = {
      permissions: {
        allow: ["Bash(node:*)", "Bash(npm install:*)", "Bash(python3 *)", "Bash(pip:*)"],
      },
    };
    assert.equal(findBroadPermissionIssues(settings).length, 4);
  });

  it("rejects nonexistent npm workflows referenced by skills", () => {
    assert.deepEqual(
      findWorkflowReferenceIssues([["skill", "Run npm run verify:missing"]], {
        lint: "biome check",
      }),
      ["skill: npm workflow does not exist: verify:missing"]
    );
  });

  it("requires all four version manifests in skill and release workflow", () => {
    const incomplete = "system.json package.json";
    assert.equal(findReleaseManifestIssues(incomplete, incomplete).length, 4);
  });

  it("rejects shared local IDE MCP servers", () => {
    const mcp = {
      mcpServers: { phpstorm: { type: "http", url: "http://127.0.0.1:12345/stream" } },
    };
    assert.deepEqual(findLocalIdeMcpIssues(mcp), ["shared local IDE MCP: phpstorm"]);
  });
});
