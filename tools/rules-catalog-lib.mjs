import crypto from "node:crypto";

export function catalogDigest(catalog) {
  const payload = {
    schemaVersion: catalog.schemaVersion,
    sourceRevision: catalog.sourceRevision,
    sources: catalog.sources,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function validateSource(slug, source) {
  const issues = [];
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug)) {
    issues.push(`invalid slug: ${slug}`);
  }
  if (!source || typeof source !== "object") {
    issues.push(`${slug}: invalid source metadata`);
    return issues;
  }
  if (!Number.isInteger(source.pages) || source.pages < 1) {
    issues.push(`${slug}: invalid page count`);
  }
  if (!/^[0-9a-f]{64}$/.test(source.sha256 ?? "")) {
    issues.push(`${slug}: invalid SHA-256`);
  }
  return issues;
}

export function validateRulesCatalog(catalog) {
  const issues = [];
  if (!catalog || typeof catalog !== "object") {
    return ["catalog is missing or invalid"];
  }
  if (catalog.schemaVersion !== 1) {
    issues.push("schemaVersion must be 1");
  }
  if (!/^[0-9a-f]{40}$/.test(catalog.sourceRevision ?? "")) {
    issues.push("sourceRevision must be a full Git SHA-1");
  }
  if (!catalog.sources || typeof catalog.sources !== "object") {
    issues.push("sources map is missing");
    return issues;
  }
  for (const [slug, source] of Object.entries(catalog.sources)) {
    issues.push(...validateSource(slug, source));
  }
  if (catalog.catalogSha256 !== catalogDigest(catalog)) {
    issues.push("catalog SHA-256 mismatch");
  }
  return issues;
}

export function catalogPageMap(catalog) {
  return new Map(Object.entries(catalog.sources).map(([slug, source]) => [slug, source.pages]));
}
