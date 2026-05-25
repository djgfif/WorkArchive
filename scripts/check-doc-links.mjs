import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = process.cwd();
const targets = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs'];
const failures = [];

function collectMarkdown(path) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const stat = statSync(absolutePath);
  if (stat.isFile()) {
    return extname(absolutePath).toLowerCase() === '.md' ? [absolutePath] : [];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      return [];
    }
    return collectMarkdown(resolve(path, entry.name));
  });
}

function localTargetFromHref(href) {
  if (
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:')
  ) {
    return null;
  }

  const withoutAnchor = href.split('#')[0];
  const withoutQuery = withoutAnchor.split('?')[0];
  return withoutQuery || null;
}

for (const file of targets.flatMap(collectMarkdown)) {
  const text = await import('node:fs').then(({ readFileSync }) =>
    readFileSync(file, 'utf8'),
  );
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const match of text.matchAll(linkPattern)) {
    const href = match[1].trim();
    const target = localTargetFromHref(href);
    if (!target) {
      continue;
    }

    const resolved = resolve(dirname(file), decodeURI(target));
    if (!existsSync(resolved)) {
      failures.push(
        `${file.replace(`${root}/`, '')}: missing link target ${href}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Markdown local links passed.');
