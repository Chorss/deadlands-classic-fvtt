import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findBroadPermissionIssues,
  findLocalIdeMcpIssues,
  findPrivatePathIssues,
  findProjectMcpIssues,
  findReleaseManifestIssues,
  findTomlIssues,
  findUnpinnedActionIssues,
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

  it("allows only the two portable project MCP servers", () => {
    const portable = { mcpServers: { playwright: {}, "deadlands-rules-ref": {} } };
    assert.deepEqual(findProjectMcpIssues(portable), []);
    assert.equal(
      findProjectMcpIssues({ mcpServers: { ...portable.mcpServers, context7: {} } }).length,
      1
    );
  });

  it("requires GitHub Actions to use full commit SHAs", () => {
    assert.deepEqual(findUnpinnedActionIssues([["ci.yml", "uses: actions/checkout@v7"]]), [
      "ci.yml: action is not pinned to a full SHA: actions/checkout@v7",
    ]);
    assert.deepEqual(
      findUnpinnedActionIssues([["ci.yml", `uses: actions/checkout@${"a".repeat(40)} # v7`]]),
      []
    );
  });
});
