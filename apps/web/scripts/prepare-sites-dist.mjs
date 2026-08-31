import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const indexOutput = resolve(distRoot, 'client', 'index.html');
const workerSource = resolve(projectRoot, 'sites', 'worker.mjs');
const workerOutput = resolve(distRoot, 'server', 'index.js');
const hostingSource = resolve(projectRoot, '.openai', 'hosting.json');
const hostingOutput = resolve(distRoot, '.openai', 'hosting.json');

const hostingConfig = JSON.parse(await readFile(hostingSource, 'utf8'));
const allowedKeys = new Set(['project_id']);
const unexpectedKeys = Object.keys(hostingConfig).filter(
  (key) => !allowedKeys.has(key),
);

if (unexpectedKeys.length > 0) {
  throw new Error(
    'Unexpected Sites hosting keys: ' + unexpectedKeys.join(', '),
  );
}

const pwaMetadataLines = [
  '    <!-- 홈 화면 설치(iOS/Android) -->',
  '    <meta name="mobile-web-app-capable" content="yes" />',
  '    <meta name="apple-mobile-web-app-capable" content="yes" />',
  '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '    <meta name="apple-mobile-web-app-title" content="Work Archive" />',
];
let sitesIndexHtml = await readFile(indexOutput, 'utf8');
for (const line of pwaMetadataLines) {
  sitesIndexHtml = sitesIndexHtml.replace(line + '\n', '');
}

if (sitesIndexHtml.includes('mobile-web-app')) {
  throw new Error('Sites output still contains PWA installation metadata.');
}

await writeFile(indexOutput, sitesIndexHtml, 'utf8');
await mkdir(dirname(workerOutput), { recursive: true });
await mkdir(dirname(hostingOutput), { recursive: true });
await copyFile(workerSource, workerOutput);
await copyFile(hostingSource, hostingOutput);
