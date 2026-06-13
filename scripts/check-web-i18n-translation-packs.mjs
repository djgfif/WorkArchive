#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(new URL('..', import.meta.url).pathname);
const baselineResourcePath = resolve(root, 'apps/web/src/app/i18n/resources/ko.ts');
const packsDir = resolve(root, 'docs/i18n/reviewed');
const requiredTranslationLocales = ['en', 'ja', 'zh-CN'];
const koreanPattern = /[가-힣]/;
const interpolationPattern = /\{\{\s*([^{}\s,]+).*?\}\}/g;

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

function collectBaselineStrings(node, prefix = '') {
  const strings = new Map();

  function visit(value, path) {
    const unwrapped = unwrapExpression(value);

    if (!unwrapped) {
      return;
    }

    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      strings.set(path, unwrapped.text);
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

  return strings;
}

function flattenTranslations(value, path = '', output = new Map()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Translation path "${path}" must be an object.`);
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;

    if (typeof nestedValue === 'string') {
      output.set(nextPath, nestedValue);
      continue;
    }

    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      flattenTranslations(nestedValue, nextPath, output);
      continue;
    }

    throw new Error(`Translation path "${nextPath}" must be a string or object.`);
  }

  return output;
}

function getInterpolationKeys(value) {
  return [...value.matchAll(interpolationPattern)].map((match) => match[1]).sort();
}

function assertSameInterpolationContract({ baseline, filePath, key, locale, target }) {
  const expected = getInterpolationKeys(baseline);
  const actual = getInterpolationKeys(target);

  if (expected.join('\0') !== actual.join('\0')) {
    throw new Error(
      `${toRepoPath(filePath)} ${locale}.${key} interpolation mismatch: expected ` +
        `[${expected.join(', ')}], got [${actual.join(', ')}].`,
    );
  }
}

function assertNoKorean({ filePath, key, locale, target }) {
  if (koreanPattern.test(target)) {
    throw new Error(`${toRepoPath(filePath)} ${locale}.${key} still contains Korean text.`);
  }
}

function validatePack(filePath, baselineStrings) {
  const pack = JSON.parse(readFileSync(filePath, 'utf8'));
  const packName = basename(filePath);

  if (!Array.isArray(pack.scope) || pack.scope.length === 0) {
    throw new Error(`${toRepoPath(filePath)} must define a non-empty scope array.`);
  }

  if (!pack.translations || typeof pack.translations !== 'object') {
    throw new Error(`${toRepoPath(filePath)} must define a translations object.`);
  }

  const scope = new Set(pack.scope);
  const expectedKeys = [...baselineStrings.keys()].filter((key) => scope.has(key.split('.')[0]));

  if (expectedKeys.length === 0) {
    throw new Error(`${toRepoPath(filePath)} scope does not match any baseline keys.`);
  }

  const presentLocales = Object.keys(pack.translations).sort();

  for (const locale of requiredTranslationLocales) {
    if (!presentLocales.includes(locale)) {
      throw new Error(`${toRepoPath(filePath)} is missing translations.${locale}.`);
    }
  }

  const unexpectedLocales = presentLocales.filter(
    (locale) => !requiredTranslationLocales.includes(locale),
  );

  if (unexpectedLocales.length > 0) {
    throw new Error(
      `${toRepoPath(filePath)} has unsupported translation locales: ${unexpectedLocales.join(', ')}.`,
    );
  }

  for (const locale of requiredTranslationLocales) {
    const translations = flattenTranslations(pack.translations[locale]);
    const missingKeys = expectedKeys.filter((key) => !translations.has(key));
    const extraKeys = [...translations.keys()].filter((key) => !expectedKeys.includes(key));

    if (missingKeys.length > 0) {
      throw new Error(
        `${toRepoPath(filePath)} ${locale} is missing keys: ${missingKeys.join(', ')}.`,
      );
    }

    if (extraKeys.length > 0) {
      throw new Error(`${toRepoPath(filePath)} ${locale} has extra keys: ${extraKeys.join(', ')}.`);
    }

    for (const key of expectedKeys) {
      const target = translations.get(key);
      const baseline = baselineStrings.get(key);

      if (!target.trim()) {
        throw new Error(`${toRepoPath(filePath)} ${locale}.${key} is empty.`);
      }

      assertNoKorean({ filePath, key, locale, target });
      assertSameInterpolationContract({ baseline, filePath, key, locale, target });
    }
  }

  return {
    keyPaths: expectedKeys,
    keys: expectedKeys.length,
    locales: requiredTranslationLocales.length,
    packName,
  };
}

const baselineStrings = collectBaselineStrings(
  getExportedResourceObject(baselineResourcePath),
);
const packFiles = readdirSync(packsDir)
  .filter((fileName) => fileName.endsWith('.json'))
  .sort()
  .map((fileName) => resolve(packsDir, fileName));

if (packFiles.length === 0) {
  throw new Error(`${toRepoPath(packsDir)} must contain at least one reviewed translation pack.`);
}

const summaries = packFiles.map((filePath) => validatePack(filePath, baselineStrings));
const keyOwners = new Map();

for (const summary of summaries) {
  for (const keyPath of summary.keyPaths) {
    const owners = keyOwners.get(keyPath) ?? [];
    owners.push(summary.packName);
    keyOwners.set(keyPath, owners);
  }
}

const duplicatedKeys = [...keyOwners.entries()]
  .filter(([, owners]) => owners.length > 1)
  .map(([keyPath, owners]) => `${keyPath} (${owners.join(', ')})`);

if (duplicatedKeys.length > 0) {
  throw new Error(`Translation packs contain duplicate keys: ${duplicatedKeys.join('; ')}.`);
}

const coveredKeyCount = keyOwners.size;

console.log('Web i18n translation pack check passed.');

for (const summary of summaries) {
  console.log(`- ${summary.packName}: ${summary.keys} keys x ${summary.locales} locales`);
}

console.log(`Reviewed coverage: ${coveredKeyCount}/${baselineStrings.size} unique baseline paths`);
