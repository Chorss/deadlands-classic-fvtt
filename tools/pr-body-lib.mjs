const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

function checked(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^- \\[x\\] ${escaped}$`, "imu").test(body);
}

function section(body, heading) {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) {
    return "";
  }
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next < 0 ? lines.length : next;
  return lines
    .slice(start + 1, end)
    .join("\n")
    .replace(HTML_COMMENT_RE, "")
    .trim();
}

function requireExactlyOne(body, labels, name, issues) {
  const selected = labels.filter((label) => checked(body, label));
  if (selected.length !== 1) {
    issues.push(`${name}: select exactly one option`);
  }
}

export function findPrBodyIssues(body) {
  if (typeof body !== "string" || body.trim() === "") {
    return ["pull request body is required"];
  }

  const issues = [];
  const noFoundryImpact = "No Foundry runtime, UI, or API impact";
  const foundryImpact = "Foundry runtime, UI, or API impact — E2E is required";
  const e2eNotRequired = "Foundry E2E not required — no runtime, UI, or API impact";
  const e2ePassed = "Foundry E2E passed — 10/10 on Foundry 14.367";
  const noMechanicImpact = "No Deadlands mechanic or content impact";
  const mechanicImpact = "Deadlands mechanic or content impact — evidence is required";

  requireExactlyOne(body, [noFoundryImpact, foundryImpact], "Foundry impact", issues);
  requireExactlyOne(body, [e2eNotRequired, e2ePassed], "Foundry verification", issues);
  requireExactlyOne(body, [noMechanicImpact, mechanicImpact], "mechanic/content impact", issues);

  if (checked(body, foundryImpact) && !checked(body, e2ePassed)) {
    issues.push("Foundry-impacting changes require a checked 10/10 E2E result");
  }
  if (checked(body, noFoundryImpact) && !checked(body, e2eNotRequired)) {
    issues.push("non-runtime changes must explicitly mark Foundry E2E not required");
  }
  if (!checked(body, "`npm run verify:ci` passes")) {
    issues.push("canonical verify:ci result is not checked");
  }

  const evidence = section(body, "Rulebook evidence");
  if (checked(body, mechanicImpact) && !/\b[a-z][a-z0-9-]{1,40}\s+p\.\d{1,4}\b/.test(evidence)) {
    issues.push("mechanic/content changes require at least one <slug> p.N citation");
  }
  if (section(body, "Untested") === "") {
    issues.push('Untested section must say "None" or list untested work');
  }
  return issues;
}
