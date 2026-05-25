import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoot = path.resolve(projectRoot, 'apps/web/src');
const extensions = ['.ts', '.tsx'];
const aliasRoots = new Map([
  ['@app', path.resolve(sourceRoot, 'app')],
  ['@features', path.resolve(sourceRoot, 'features')],
  ['@shared', path.resolve(sourceRoot, 'shared')],
  ['@test', path.resolve(sourceRoot, 'test')],
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

function isTypeOnlyNamedImports(bindings) {
  return Boolean(
    bindings &&
    ts.isNamedImports(bindings) &&
    bindings.elements.every((element) => element.isTypeOnly),
  );
}

function isTypeOnlyNamedExports(exportClause) {
  return Boolean(
    exportClause &&
    ts.isNamedExports(exportClause) &&
    exportClause.elements.every((element) => element.isTypeOnly),
  );
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

const graph = new Map();
const edges = [];

for (const filePath of files) {
  graph.set(filePath, []);

  for (const statement of createSourceFile(filePath).statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      if (statement.importClause?.isTypeOnly) {
        continue;
      }

      if (
        statement.importClause &&
        !statement.importClause.name &&
        isTypeOnlyNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }

      const target = resolveModule(filePath, statement.moduleSpecifier.text);

      if (target) {
        graph.get(filePath).push(target);
        edges.push([filePath, target, 'import']);
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      if (
        statement.isTypeOnly ||
        isTypeOnlyNamedExports(statement.exportClause)
      ) {
        continue;
      }

      const target = resolveModule(filePath, statement.moduleSpecifier.text);

      if (target) {
        graph.get(filePath).push(target);
        edges.push([filePath, target, 'export']);
      }
    }
  }
}

const indexByFile = new Map();
const lowlinkByFile = new Map();
const stack = [];
const stacked = new Set();
const cycleComponents = [];
let nextIndex = 0;

function visit(filePath) {
  indexByFile.set(filePath, nextIndex);
  lowlinkByFile.set(filePath, nextIndex);
  nextIndex += 1;
  stack.push(filePath);
  stacked.add(filePath);

  for (const target of graph.get(filePath) ?? []) {
    if (!indexByFile.has(target)) {
      visit(target);
      lowlinkByFile.set(
        filePath,
        Math.min(lowlinkByFile.get(filePath), lowlinkByFile.get(target)),
      );
      continue;
    }

    if (stacked.has(target)) {
      lowlinkByFile.set(
        filePath,
        Math.min(lowlinkByFile.get(filePath), indexByFile.get(target)),
      );
    }
  }

  if (lowlinkByFile.get(filePath) !== indexByFile.get(filePath)) {
    return;
  }

  const component = [];
  let current;

  do {
    current = stack.pop();
    stacked.delete(current);
    component.push(current);
  } while (current !== filePath);

  if (component.length > 1) {
    cycleComponents.push(component);
  }
}

for (const filePath of files) {
  if (!indexByFile.has(filePath)) {
    visit(filePath);
  }
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath);
}

if (cycleComponents.length === 0) {
  console.log('No web import cycles found.');
  process.exit(0);
}

console.error(`Found ${cycleComponents.length} web import cycle component(s).`);

for (const component of cycleComponents.sort(
  (left, right) => right.length - left.length,
)) {
  const componentSet = new Set(component);

  console.error('');
  console.error(`Cycle component (${component.length} files):`);

  for (const filePath of component.sort()) {
    console.error(`  ${relativePath(filePath)}`);
  }

  console.error('Internal edges:');

  for (const [from, to, kind] of edges) {
    if (componentSet.has(from) && componentSet.has(to)) {
      console.error(`  ${kind}: ${relativePath(from)} -> ${relativePath(to)}`);
    }
  }
}

process.exit(1);
