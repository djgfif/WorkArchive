import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoot = path.resolve(projectRoot, 'apps/web/src');
const featuresRoot = path.resolve(sourceRoot, 'features');
const extensions = ['.ts', '.tsx'];
const aliasRoots = new Map([
  ['@app', path.resolve(sourceRoot, 'app')],
  ['@features', featuresRoot],
  ['@shared', path.resolve(sourceRoot, 'shared')],
  ['@test', path.resolve(sourceRoot, 'test')],
]);
const allowedCrossFeatureEntryFiles = new Set([
  'works/storage.ts',
  'works/data.ts',
  'works/routes.ts',
  'sync/queue.ts',
  'tier-boards/data.ts',
]);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules') {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath, files);
      continue;
    }

    if (extensions.includes(path.extname(entry.name))) {
      files.push(path.resolve(entryPath));
    }
  }

  return files;
}

const files = new Set(walk(sourceRoot));

function resolveModule(fromFile, moduleSpecifier) {
  let basePath = null;

  if (moduleSpecifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), moduleSpecifier);
  } else {
    for (const [alias, aliasRoot] of aliasRoots) {
      if (moduleSpecifier === alias) {
        basePath = aliasRoot;
        break;
      }

      if (moduleSpecifier.startsWith(`${alias}/`)) {
        basePath = path.resolve(
          aliasRoot,
          moduleSpecifier.slice(alias.length + 1),
        );
        break;
      }
    }
  }

  if (!basePath) {
    return null;
  }

  const candidates = [
    basePath,
    ...extensions.map((extension) => `${basePath}${extension}`),
    ...extensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

function createSourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function getFeatureName(filePath) {
  const relativeToFeatures = path.relative(featuresRoot, filePath);

  if (relativeToFeatures.startsWith('..')) {
    return null;
  }

  return relativeToFeatures.split(path.sep)[0] || null;
}

function getFeatureRelativePath(filePath) {
  return path.relative(featuresRoot, filePath).replaceAll(path.sep, '/');
}

function isAllowedCrossFeatureTarget(filePath) {
  const featureRelativePath = getFeatureRelativePath(filePath);
  const [, ...entryParts] = featureRelativePath.split('/');
  const entryRelativePath = entryParts.join('/');

  return (
    entryRelativePath === 'index.ts' ||
    entryRelativePath === 'index.tsx' ||
    allowedCrossFeatureEntryFiles.has(featureRelativePath)
  );
}

function getModuleSpecifiers(filePath) {
  const specifiers = [];

  for (const statement of createSourceFile(filePath).statements) {
    if (
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }

  return specifiers;
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath);
}

const violations = [];

for (const filePath of files) {
  const sourceFeature = getFeatureName(filePath);

  for (const moduleSpecifier of getModuleSpecifiers(filePath)) {
    const target = resolveModule(filePath, moduleSpecifier);

    if (!target) {
      continue;
    }

    const targetFeature = getFeatureName(target);

    if (!targetFeature || sourceFeature === targetFeature) {
      continue;
    }

    if (isAllowedCrossFeatureTarget(target)) {
      continue;
    }

    violations.push({
      from: relativePath(filePath),
      moduleSpecifier,
      to: relativePath(target),
    });
  }
}

if (violations.length === 0) {
  console.log('No web feature boundary violations found.');
  process.exit(0);
}

console.error(`Found ${violations.length} web feature boundary violation(s).`);

for (const violation of violations) {
  console.error(
    `  ${violation.from} imports ${violation.moduleSpecifier} -> ${violation.to}`,
  );
}

process.exit(1);
