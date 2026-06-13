#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(new URL('..', import.meta.url).pathname);
const resourcesDir = resolve(root, 'apps/web/src/app/i18n/resources');
const localesPath = resolve(root, 'apps/web/src/app/i18n/locales.ts');
const baselineLocale = 'ko';
const koreanPattern = /[가-힣]/;
const interpolationPattern = /\{\{\s*([^{}\s,]+).*?\}\}/g;
const localeFileNames = new Map([
  ['ko', 'ko.ts'],
  ['en', 'en.ts'],
  ['ja', 'ja.ts'],
  ['zh-CN', 'zh-CN.ts'],
]);

function toRepoPath(path) {
  return relative(root, path).replaceAll('\\', '/');
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

function getExportedArray(sourceFile, name) {
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
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) {
        continue;
      }

      const initializer = unwrapExpression(declaration.initializer);

      if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
        throw new Error(`${name} must be an exported array literal.`);
      }

      return initializer.elements.map((element) => {
        if (!ts.isStringLiteral(element)) {
          throw new Error(`${name} must contain only string literals.`);
        }

        return element.text;
      });
    }
  }

  throw new Error(`${name} export was not found.`);
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

function getExportedResourceObject(path) {
  const sourceFile = parseSource(path);

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

  throw new Error(`${toRepoPath(path)} must export a resource object literal.`);
}

function collectShape(node, prefix = '') {
  const shape = new Map();

  function add(path, kind) {
    shape.set(path, kind);
  }

  function visit(value, path) {
    const unwrapped = unwrapExpression(value);

    if (!unwrapped) {
      add(path, 'unknown');
      return;
    }

    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      add(path, 'string');
      return;
    }

    if (ts.isObjectLiteralExpression(unwrapped)) {
      for (const property of unwrapped.properties) {
        if (!ts.isPropertyAssignment(property)) {
          add(path, 'unsupported-object-member');
          continue;
        }

        const key = getPropertyName(property.name);

        if (!key) {
          add(path, 'unsupported-object-key');
          continue;
        }

        visit(property.initializer, path ? `${path}.${key}` : key);
      }
      return;
    }

    if (ts.isArrayLiteralExpression(unwrapped)) {
      if (unwrapped.elements.length === 0) {
        add(path, 'array');
        return;
      }

      const objectElements = unwrapped.elements.filter((element) =>
        ts.isObjectLiteralExpression(unwrapExpression(element)),
      );

      if (objectElements.length > 0) {
        for (const element of objectElements) {
          visit(element, `${path}[]`);
        }
        return;
      }

      const allStrings = unwrapped.elements.every((element) => {
        const unwrappedElement = unwrapExpression(element);
        return (
          unwrappedElement &&
          (ts.isStringLiteral(unwrappedElement) ||
            ts.isNoSubstitutionTemplateLiteral(unwrappedElement))
        );
      });

      add(path, allStrings ? 'string[]' : 'array');
      return;
    }

    if (
      unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
      unwrapped.kind === ts.SyntaxKind.FalseKeyword
    ) {
      add(path, 'boolean');
      return;
    }

    if (ts.isNumericLiteral(unwrapped)) {
      add(path, 'number');
      return;
    }

    add(path, ts.SyntaxKind[unwrapped.kind] ?? 'unknown');
  }

  visit(node, prefix);

  return shape;
}

function collectStrings(node, prefix = '') {
  const strings = new Map();

  function add(path, value) {
    strings.set(path, value);
  }

  function visit(value, path) {
    const unwrapped = unwrapExpression(value);

    if (!unwrapped) {
      return;
    }

    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      add(path, unwrapped.text);
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
        const arrayPath = `${path}[${index}]`;

        if (unwrappedElement && ts.isObjectLiteralExpression(unwrappedElement)) {
          visit(unwrappedElement, `${path}[]`);
          return;
        }

        visit(element, arrayPath);
      });
    }
  }

  visit(node, prefix);

  return strings;
}

function collectInterpolationNames(value) {
  return [...value.matchAll(interpolationPattern)]
    .map((match) => match[1])
    .sort();
}

function compareStringContracts(locale, baselineStrings, localeStrings) {
  const findings = [];

  for (const [path, baselineValue] of sortedEntries(baselineStrings)) {
    const localizedValue = localeStrings.get(path);

    if (typeof localizedValue !== 'string') {
      continue;
    }

    if (koreanPattern.test(localizedValue)) {
      findings.push(`${locale}: untranslated Korean remains at ${path}`);
    }

    const baselineInterpolation = collectInterpolationNames(baselineValue);
    const localizedInterpolation = collectInterpolationNames(localizedValue);

    if (baselineInterpolation.join('\0') !== localizedInterpolation.join('\0')) {
      findings.push(
        `${locale}: interpolation mismatch at ${path}; expected {${baselineInterpolation.join(
          ', ',
        )}}, got {${localizedInterpolation.join(', ')}}`,
      );
    }
  }

  return findings;
}

function sortedEntries(map) {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function compareShape(locale, baselineShape, localeShape) {
  const findings = [];

  for (const [path, kind] of sortedEntries(baselineShape)) {
    const actualKind = localeShape.get(path);

    if (!actualKind) {
      findings.push(`${locale}: missing key ${path}`);
      continue;
    }

    if (actualKind !== kind) {
      findings.push(`${locale}: key ${path} has ${actualKind}, expected ${kind}`);
    }
  }

  for (const [path] of sortedEntries(localeShape)) {
    if (!baselineShape.has(path)) {
      findings.push(`${locale}: extra key ${path}`);
    }
  }

  return findings;
}

const localesSource = parseSource(localesPath);
const supportedLocales = getExportedArray(localesSource, 'SUPPORTED_LOCALES');
const enabledLocales = getExportedArray(localesSource, 'ENABLED_LOCALES');
const supportedSet = new Set(supportedLocales);
const resourceFiles = readdirSync(resourcesDir)
  .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
  .sort();
const localeByFile = new Map(
  [...localeFileNames].map(([locale, fileName]) => [fileName, locale]),
);
const resourceLocales = new Map();
const findings = [];

for (const file of resourceFiles) {
  const locale = localeByFile.get(file);

  if (!locale) {
    findings.push(`Unexpected resource file apps/web/src/app/i18n/resources/${file}`);
    continue;
  }

  if (!supportedSet.has(locale)) {
    findings.push(`${locale}: resource exists but locale is not supported`);
    continue;
  }

  resourceLocales.set(locale, resolve(resourcesDir, file));
}

for (const locale of enabledLocales) {
  if (!resourceLocales.has(locale)) {
    findings.push(`${locale}: enabled locale is missing ${localeFileNames.get(locale)}`);
  }
}

const baselinePath = resourceLocales.get(baselineLocale);

if (!baselinePath) {
  findings.push(`${baselineLocale}: baseline resource is missing`);
} else {
  const baselineObject = getExportedResourceObject(baselinePath);
  const baselineShape = collectShape(baselineObject);
  const baselineStrings = collectStrings(baselineObject);

  for (const [locale, path] of resourceLocales) {
    if (locale === baselineLocale) {
      continue;
    }

    const localeObject = getExportedResourceObject(path);
    findings.push(
      ...compareShape(locale, baselineShape, collectShape(localeObject)),
      ...compareStringContracts(locale, baselineStrings, collectStrings(localeObject)),
    );
  }
}

if (findings.length > 0) {
  console.error('Web i18n resource parity check failed.');
  console.error('');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Web i18n resource parity check passed.');
console.log(`Supported locales: ${supportedLocales.join(', ')}`);
console.log(`Enabled locales: ${enabledLocales.join(', ')}`);
console.log(
  `Resource locales: ${[...resourceLocales.keys()].sort().join(', ')}`,
);
