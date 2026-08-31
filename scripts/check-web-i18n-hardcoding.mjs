#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(new URL('..', import.meta.url).pathname);
const srcRoot = resolve(root, 'apps/web/src');
const koreanPattern = /[가-힣]/;
const sourceExtensions = new Set(['.ts', '.tsx']);

const allowedFiles = new Map([
  [
    'apps/web/src/app/i18n/resources/community.ts',
    'locale-scoped Community translation resource',
  ],
  [
    'apps/web/src/app/i18n/locales.ts',
    'locale option native labels include each language name',
  ],
  ['apps/web/src/app/i18n/resources/ko.ts', 'Korean translation resource'],
  [
    'apps/web/src/features/imports/services/csv-import.service.ts',
    'CSV import parser intentionally accepts Korean headers and status aliases',
  ],
  [
    'apps/web/src/shared/utils/korean-particle.ts',
    'Korean grammar helper for Korean translation strings',
  ],
]);

function isSourceFile(path) {
  return [...sourceExtensions].some((extension) => path.endsWith(extension));
}

function shouldSkipFile(path) {
  return (
    path.includes('/node_modules/') ||
    path.includes('/dist/') ||
    path.includes('/src/shared/generated/') ||
    path.includes('/src/test/') ||
    path.endsWith('.test.ts') ||
    path.endsWith('.test.tsx') ||
    path.endsWith('.spec.ts') ||
    path.endsWith('.spec.tsx') ||
    !isSourceFile(path)
  );
}

function collectFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectFiles(path));
    } else if (!shouldSkipFile(path)) {
      files.push(path);
    }
  }

  return files;
}

function toRepoPath(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function lineAndColumn(sourceText, position) {
  const prefix = sourceText.slice(0, position);
  const lines = prefix.split('\n');

  return {
    column: lines.at(-1).length + 1,
    line: lines.length,
  };
}

function literalText(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.JsxText
  ) {
    return node.getText().replace(/^['"`]|['"`]$/g, '');
  }

  if (
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return node.text;
  }

  return null;
}

function inspectFile(path) {
  const repoPath = toRepoPath(path);

  if (allowedFiles.has(repoPath)) {
    return [];
  }

  const sourceText = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];

  function visit(node) {
    const text = literalText(node);

    if (text && koreanPattern.test(text)) {
      const location = lineAndColumn(sourceText, node.getStart(sourceFile));
      findings.push({
        column: location.column,
        line: location.line,
        path: repoPath,
        text: text.length > 80 ? `${text.slice(0, 77)}...` : text,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return findings;
}

const findings = collectFiles(srcRoot).flatMap(inspectFile);

if (findings.length > 0) {
  console.error(
    'Korean UI literals must live in apps/web/src/app/i18n/resources/ko.ts.',
  );
  console.error(
    'Move user-facing copy to i18n or add a narrowly justified exception.',
  );
  console.error('');

  for (const finding of findings) {
    console.error(
      `${finding.path}:${finding.line}:${finding.column} ${JSON.stringify(
        finding.text,
      )}`,
    );
  }

  process.exit(1);
}

console.log('Web i18n hardcoding check passed.');
console.log('Allowed exception files:');
for (const [path, reason] of allowedFiles) {
  console.log(`- ${path}: ${reason}`);
}
