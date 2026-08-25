const RUNTIME_MARKER = "$" + "{…}";
const INTERPOLATION_OPEN = "$" + "{";

function findKeyIssues(key, expression, prefix, knownKeys, listedKeys) {
  const issues = [];
  if (typeof key !== "string" || key.includes("*") || key.includes(INTERPOLATION_OPEN)) {
    issues.push(`runtime contract contains a non-explicit key: ${String(key)}`);
  } else if (!key.startsWith(prefix)) {
    issues.push(`${key} is outside runtime expression ${expression}`);
  } else if (!knownKeys.has(key)) {
    issues.push(`runtime key is missing from lang/en.json: ${key}`);
  }
  if (listedKeys.has(key)) {
    issues.push(`runtime key is listed more than once: ${key}`);
  }
  listedKeys.add(key);
  return issues;
}

function findContractIssues(contract, observed, contracted, knownKeys, listedKeys) {
  const issues = [];
  const { expression, keys } = contract;
  if (typeof expression !== "string" || !expression.endsWith(RUNTIME_MARKER)) {
    return ["runtime contract has an invalid expression"];
  }
  if (contracted.has(expression)) {
    issues.push(`duplicate runtime contract: ${expression}`);
  }
  contracted.add(expression);
  if (!observed.has(expression)) {
    issues.push(`unused runtime exception: ${expression}`);
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    issues.push(`runtime contract has no explicit keys: ${expression}`);
    return issues;
  }

  const prefix = expression.slice(0, -RUNTIME_MARKER.length);
  for (const key of keys) {
    issues.push(...findKeyIssues(key, expression, prefix, knownKeys, listedKeys));
  }
  return issues;
}

export function findRuntimeContractIssues(expressions, knownKeys, config) {
  if (config?.schemaVersion !== 1 || !Array.isArray(config.contracts)) {
    return ["runtime key contract must use schemaVersion 1 and a contracts array"];
  }
  const issues = [];
  const observed = new Set(expressions);
  const contracted = new Set();
  const listedKeys = new Set();

  for (const contract of config.contracts) {
    issues.push(...findContractIssues(contract, observed, contracted, knownKeys, listedKeys));
  }

  for (const expression of observed) {
    if (!contracted.has(expression)) {
      issues.push(`runtime expression has no explicit key contract: ${expression}`);
    }
  }
  return issues;
}
