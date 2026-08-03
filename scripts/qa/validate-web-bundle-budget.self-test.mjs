#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  inspectJavaScriptChunks,
  validateWebBundleBudget,
} from './validate-web-bundle-budget.mjs';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);
const fixtureRoot = join(repositoryRoot, 'tmp/web-bundle-budget-self-test');
const passingAssets = join(fixtureRoot, 'passing');
const failingAssets = join(fixtureRoot, 'failing');
const emptyAssets = join(fixtureRoot, 'empty');

rmSync(fixtureRoot, { force: true, recursive: true });

try {
  mkdirSync(passingAssets, { recursive: true });
  mkdirSync(failingAssets, { recursive: true });
  mkdirSync(emptyAssets, { recursive: true });

  writeFileSync(join(passingAssets, 'small.js'), '12345');
  writeFileSync(join(passingAssets, 'at-limit.js'), '1234567890');
  writeFileSync(join(passingAssets, 'ignored.css'), 'x'.repeat(50));

  const passingResult = validateWebBundleBudget({
    assetsDirectory: passingAssets,
    budgetBytes: 10,
  });

  assert.equal(passingResult.chunks.length, 2);
  assert.equal(passingResult.chunks[0]?.fileName, 'at-limit.js');
  assert.equal(passingResult.violations.length, 0);

  writeFileSync(join(failingAssets, 'over-budget.js'), '12345678901');

  const failingResult = validateWebBundleBudget({
    assetsDirectory: failingAssets,
    budgetBytes: 10,
  });

  assert.equal(failingResult.violations.length, 1);
  assert.equal(failingResult.violations[0]?.fileName, 'over-budget.js');

  assert.throws(
    () => inspectJavaScriptChunks(emptyAssets),
    /No JavaScript chunks found/,
  );
  assert.throws(
    () =>
      validateWebBundleBudget({
        assetsDirectory: passingAssets,
        budgetBytes: 0,
      }),
    /positive integer/,
  );

  console.log('Web bundle budget self-test passed.');
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
