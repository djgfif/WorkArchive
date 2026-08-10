#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_JS_CHUNK_BUDGET_BYTES = 650_000;

const repositoryRoot = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);
const defaultAssetsDirectory = join(repositoryRoot, 'apps/web/dist/assets');

export function inspectJavaScriptChunks(assetsDirectory) {
  const chunks = readdirSync(assetsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => {
      const sizeBytes = statSync(join(assetsDirectory, entry.name)).size;

      return {
        fileName: entry.name,
        sizeBytes,
      };
    })
    .sort((left, right) => right.sizeBytes - left.sizeBytes);

  if (chunks.length === 0) {
    throw new Error(
      `No JavaScript chunks found in ${assetsDirectory}. Run the web build first.`,
    );
  }

  return chunks;
}

export function validateWebBundleBudget({
  assetsDirectory = defaultAssetsDirectory,
  budgetBytes = DEFAULT_JS_CHUNK_BUDGET_BYTES,
} = {}) {
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0) {
    throw new Error('Web bundle budget must be a positive integer.');
  }

  const chunks = inspectJavaScriptChunks(assetsDirectory);
  const violations = chunks.filter((chunk) => chunk.sizeBytes > budgetBytes);

  return {
    budgetBytes,
    chunks,
    violations,
  };
}

export function runWebBundleBudgetValidation(options) {
  const result = validateWebBundleBudget(options);
  const largestChunk = result.chunks[0];

  console.log(
    `Web bundle budget: largest JavaScript chunk ${largestChunk.fileName} ` +
      `is ${largestChunk.sizeBytes.toLocaleString('en-US')} bytes ` +
      `(limit ${result.budgetBytes.toLocaleString('en-US')}).`,
  );

  if (result.violations.length === 0) {
    console.log(
      `Web bundle budget passed for ${result.chunks.length} JavaScript chunks.`,
    );
    return result;
  }

  for (const violation of result.violations) {
    console.error(
      `Web bundle budget exceeded: ${violation.fileName} is ` +
        `${violation.sizeBytes.toLocaleString('en-US')} bytes.`,
    );
  }

  throw new Error(
    `${result.violations.length} JavaScript chunk(s) exceed the ` +
      `${result.budgetBytes.toLocaleString('en-US')} byte limit.`,
  );
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    runWebBundleBudgetValidation(
      process.argv[2]
        ? { assetsDirectory: resolve(process.argv[2]) }
        : undefined,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
