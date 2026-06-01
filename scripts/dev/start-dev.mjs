import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '../..');
const isWindows = process.platform === 'win32';
const mode = process.argv[2] ?? 'compose';

if (!['compose', 'host'].includes(mode)) {
  console.error(`Unknown dev mode: ${mode}`);
  process.exit(1);
}

const spawnOptions = {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
};

const result = isWindows
  ? spawnSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'call', 'scripts\\dev\\start-dev.bat', mode],
      spawnOptions,
    )
  : spawnSync('bash', ['scripts/dev/start-dev.sh', mode], spawnOptions);

process.exit(result.status ?? 1);
