#!/usr/bin/env node
import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL =
  process.env.CHECK_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const SOURCE_DIRECTORIES = [
  path.resolve(__dirname, "../app"),
  path.resolve(__dirname, "../lib"),
  path.resolve(__dirname, "../components")
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function collectSourceFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectSourceFiles(fullPath);
      files.push(...nested);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractEndpoints(filePath, contents) {
  const endpoints = [];
  const templateRegex = /\$\{API_BASE_URL\}(?<path>\/api\/[A-Za-z0-9/_\-]+(?:\/[A-Za-z0-9._\-]+)*)/g;
  const literalRegex = /["'`]\/api\/[A-Za-z0-9/_\-]+(?:\/[A-Za-z0-9._\-]+)*["'`]/g;

  let match;
  while ((match = templateRegex.exec(contents)) !== null) {
    const endpoint = match.groups?.path;
    if (!endpoint) continue;
    if (endpoint.includes("${") || endpoint.includes(":")) continue;
    if (endpoint.endsWith("/")) continue;
    endpoints.push({ endpoint, filePath });
  }

  while ((match = literalRegex.exec(contents)) !== null) {
    const endpoint = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "")
      .trim();
    if (endpoint.includes("${") || endpoint.includes(":")) continue;
    if (endpoint.endsWith("/")) continue;
    endpoints.push({ endpoint, filePath });
  }

  return endpoints;
}

async function discoverEndpoints() {
  const endpointMap = new Map();

  for (const dir of SOURCE_DIRECTORIES) {
    const files = await collectSourceFiles(dir);
    for (const filePath of files) {
      const contents = await readFile(filePath, "utf8");
      const matches = extractEndpoints(filePath, contents);
      for (const { endpoint, filePath: source } of matches) {
        if (!endpointMap.has(endpoint)) {
          endpointMap.set(endpoint, new Set());
        }
        endpointMap.get(endpoint).add(path.relative(path.resolve(__dirname, ".."), source));
      }
    }
  }

  return endpointMap;
}

async function checkEndpoint(endpoint) {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "content-type": "application/json" },
      signal: controller.signal
    });
    const result = {
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText
    };

    if (!response.ok) {
      try {
        const text = await response.text();
        result.bodyPreview = text.slice(0, 200);
      } catch (error) {
        result.bodyPreview = "<unable to read response>";
      }
    }

    return result;
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      statusText: error.name === "AbortError" ? "Request timed out" : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printReport(endpointMap, results) {
  const failures = results.filter((result) => !result.ok);

  console.log("\nAPI connectivity check results\n===============================\n");
  for (const result of results) {
    const sources = Array.from(endpointMap.get(result.endpoint) ?? []);
    const statusLabel = result.ok ? "PASS" : "FAIL";
    console.log(`${statusLabel} ${result.url} (${result.status || "n/a"} ${result.statusText})`);
    if (sources.length > 0) {
      console.log(`  referenced in: ${sources.join(", ")}`);
    }
    if (!result.ok && result.bodyPreview) {
      console.log(`  response: ${result.bodyPreview}`);
    }
    console.log("");
  }

  if (failures.length > 0) {
    console.error(`${failures.length} endpoint(s) failed connectivity checks.`);
    process.exitCode = 1;
  } else {
    console.log("All endpoints responded successfully.");
  }
}

(async function main() {
  try {
    const endpointMap = await discoverEndpoints();
    const endpoints = Array.from(endpointMap.keys()).sort();

    if (endpoints.length === 0) {
      console.log("No static API endpoints discovered in frontend sources.");
      return;
    }

    const checks = await Promise.all(
      endpoints.map(async (endpoint) => {
        const result = await checkEndpoint(endpoint);
        return { ...result, endpoint };
      })
    );

    printReport(endpointMap, checks);
  } catch (error) {
    console.error("Failed to execute connectivity checks:", error);
    process.exitCode = 1;
  }
})();
