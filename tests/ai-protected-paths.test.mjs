import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  bashMayWriteProtectedPath,
  deniedReason,
  isProtectedFile,
  PROTECTED_PATHS,
} from "../.claude/hooks/protect-paths.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
describe("AI workshop protected paths", () => {
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude/settings.json"), "utf8"));

  it("configures Claude sandbox fail-closed with no unsandboxed escape hatch", () => {
    assert.equal(settings.sandbox.enabled, true);
    assert.equal(settings.sandbox.failIfUnavailable, true);
    assert.equal(settings.sandbox.autoAllowBashIfSandboxed, true);
    assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
  });

  for (const protectedPath of PROTECTED_PATHS) {
    it(`rejects file-tool and Bash writes to ${protectedPath}`, () => {
      const target = path.join(ROOT, protectedPath, protectedPath === "LICENSE" ? "" : "probe");
      assert.equal(isProtectedFile(target, ROOT), true);
      assert.equal(bashMayWriteProtectedPath(`touch ${JSON.stringify(target)}`, ROOT), true);
      assert(settings.sandbox.filesystem.denyWrite.includes(`./${protectedPath}`));
      for (const toolName of ["Write", "Edit"]) {
        assert.match(
          deniedReason({ tool_name: toolName, tool_input: { file_path: target } }, ROOT),
          /read-only/
        );
      }
      assert.match(
        deniedReason(
          { tool_name: "Bash", tool_input: { command: `touch ${JSON.stringify(target)}` } },
          ROOT
        ),
        /protected path/
      );
    });
  }

  it("rejects Git commands that mutate the protected .git directory", () => {
    assert.equal(bashMayWriteProtectedPath("git add AGENTS.md", ROOT), true);
    assert.equal(bashMayWriteProtectedPath("git commit -m test", ROOT), true);
  });

  it("allows ordinary workspace writes and read-only Git commands", () => {
    assert.equal(isProtectedFile(path.join(ROOT, "module/example.mjs"), ROOT), false);
    assert.equal(bashMayWriteProtectedPath("touch module/example.mjs", ROOT), false);
    assert.equal(bashMayWriteProtectedPath("git status --short", ROOT), false);
  });
});
