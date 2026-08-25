import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const EXPECTED = ["add-archetype", "release", "verify-foundry", "verify-mechanic", "verify-system"];

function skillNames(root) {
  return fs
    .readdirSync(path.join(ROOT, root), { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && fs.existsSync(path.join(ROOT, root, entry.name, "SKILL.md"))
    )
    .map((entry) => entry.name)
    .sort();
}

function readSkill(root, name) {
  return fs.readFileSync(path.join(ROOT, root, name, "SKILL.md"), "utf8");
}

describe("shared AI skills", () => {
  it("exposes exactly the same five workflows to Codex and Claude", () => {
    assert.deepEqual(skillNames(".agents/skills"), EXPECTED);
    assert.deepEqual(skillNames(".claude/skills"), EXPECTED);
  });

  for (const name of EXPECTED) {
    it(`keeps the Claude ${name} skill as a canonical adapter`, () => {
      assert.match(
        readSkill(".claude/skills", name),
        new RegExp(`\\.agents/skills/${name}/SKILL\\.md`)
      );
    });
  }

  it("release workflow synchronizes every manifest and never auto-tags", () => {
    const skill = readSkill(".agents/skills", "release");
    for (const manifest of [
      "system.json",
      "package.json",
      "package-lock.json",
      "content/module.json",
    ]) {
      assert(skill.includes(`\`${manifest}\``), `release skill omits ${manifest}`);
    }
    assert.match(skill, /never creates or pushes a tag/i);
    assert.match(skill, /npm run verify:ci/);
    assert.match(skill, /npm run test:e2e/);
  });

  it("archetype workflow matches biography and Harrowed overlay contracts", () => {
    const skill = readSkill(".agents/skills", "add-archetype");
    assert.match(skill, /system\.biography/);
    assert.match(skill, /HTMLField/);
    assert.match(skill, /schemaFields/);
    assert.match(skill, /isActive\(actor\)/);
    assert.match(skill, /OverlayRegistry/);
    assert.match(skill, /Do not create a `documentTypes\.Actor` entry/);
  });
});
