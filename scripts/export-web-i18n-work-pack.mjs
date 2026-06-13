#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(new URL('..', import.meta.url).pathname);
const resourcePath = resolve(root, 'apps/web/src/app/i18n/resources/ko.ts');
const interpolationPattern = /\{\{\s*([^{}\s,]+).*?\}\}/g;
const rawArgs = process.argv.slice(2);
const supportedFlags = new Set(['--help', '--summary']);
const unsupportedFlags = rawArgs.filter((arg) => arg.startsWith('--') && !supportedFlags.has(arg));

if (unsupportedFlags.length > 0) {
  throw new Error(`Unsupported option: ${unsupportedFlags.join(', ')}`);
}

const showHelp = rawArgs.includes('--help');
const showSummary = rawArgs.includes('--summary');
const sectionFilter = rawArgs.find((arg) => !arg.startsWith('--')) ?? '';

if (showHelp) {
  console.log(`Usage: npm run i18n:export-work-pack -- [section] [--summary]

Exports Korean source strings from apps/web/src/app/i18n/resources/ko.ts.

Arguments:
  section     Optional top-level resource section, such as common, auth, works.

Options:
  --summary   Print section counts instead of JSONL translation entries.
  --help      Show this help text.
`);
  process.exit(0);
}

function parseSource(path) {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function unwrapExpression(node) {
  if (!node) {
    return null;
  }

  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return unwrapExpression(node.expression);
  }

  return node;
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function getExportedResourceObject(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );

    if (!isExported) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      const initializer = unwrapExpression(declaration.initializer);

      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        return initializer;
      }
    }
  }

  throw new Error('Expected an exported resource object literal.');
}

function collectEntries(node, prefix = '') {
  const entries = [];

  function visit(value, path) {
    const unwrapped = unwrapExpression(value);

    if (!unwrapped) {
      return;
    }

    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      entries.push({
        interpolations: [...unwrapped.text.matchAll(interpolationPattern)].map(
          (match) => match[1],
        ),
        key: path,
        source: unwrapped.text,
      });
      return;
    }

    if (ts.isObjectLiteralExpression(unwrapped)) {
      for (const property of unwrapped.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const key = getPropertyName(property.name);

        if (key) {
          visit(property.initializer, path ? `${path}.${key}` : key);
        }
      }
      return;
    }

    if (ts.isArrayLiteralExpression(unwrapped)) {
      unwrapped.elements.forEach((element, index) => {
        const unwrappedElement = unwrapExpression(element);

        if (unwrappedElement && ts.isObjectLiteralExpression(unwrappedElement)) {
          visit(unwrappedElement, `${path}[]`);
          return;
        }

        visit(element, `${path}[${index}]`);
      });
    }
  }

  visit(node, prefix);

  return entries;
}

function summarizeEntries(entriesToSummarize) {
  const sections = new Map();

  for (const entry of entriesToSummarize) {
    const section = entry.key.split('.')[0] ?? entry.key;
    const current = sections.get(section) ?? {
      interpolationKeys: new Set(),
      interpolationTotal: 0,
      strings: 0,
      stringsWithInterpolations: 0,
    };

    current.strings += 1;

    if (entry.interpolations.length > 0) {
      current.stringsWithInterpolations += 1;
      current.interpolationTotal += entry.interpolations.length;

      for (const interpolation of entry.interpolations) {
        current.interpolationKeys.add(interpolation);
      }
    }

    sections.set(section, current);
  }

  const rows = [...sections.entries()]
    .map(([section, summary]) => ({
      interpolationKeys: [...summary.interpolationKeys].sort().join(', '),
      interpolationTotal: summary.interpolationTotal,
      section,
      strings: summary.strings,
      stringsWithInterpolations: summary.stringsWithInterpolations,
    }))
    .sort((left, right) => left.section.localeCompare(right.section));

  const totals = rows.reduce(
    (accumulator, row) => ({
      interpolationTotal: accumulator.interpolationTotal + row.interpolationTotal,
      strings: accumulator.strings + row.strings,
      stringsWithInterpolations:
        accumulator.stringsWithInterpolations + row.stringsWithInterpolations,
    }),
    { interpolationTotal: 0, strings: 0, stringsWithInterpolations: 0 },
  );

  console.log(
    [
      'section',
      'strings',
      'strings_with_interpolations',
      'interpolation_total',
      'interpolation_keys',
    ].join('\t'),
  );

  for (const row of rows) {
    console.log(
      [
        row.section,
        row.strings,
        row.stringsWithInterpolations,
        row.interpolationTotal,
        row.interpolationKeys,
      ].join('\t'),
    );
  }

  console.log(
    [
      'TOTAL',
      totals.strings,
      totals.stringsWithInterpolations,
      totals.interpolationTotal,
      '',
    ].join('\t'),
  );
}

const entries = collectEntries(getExportedResourceObject(parseSource(resourcePath)))
  .filter((entry) => !sectionFilter || entry.key.startsWith(`${sectionFilter}.`))
  .sort((left, right) => left.key.localeCompare(right.key));

if (showSummary) {
  summarizeEntries(entries);
  process.exit(0);
}

for (const entry of entries) {
  console.log(JSON.stringify(entry));
}
