import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const launcher = resolve(scriptDir, isWindows ? 'start-dev.bat' : 'start-dev.sh');
const mode = process.argv[2] ?? 'compose';

if (!['compose', 'host'].includes(mode)) {
  console.error(`Unknown dev mode: ${mode}`);
  process.exit(1);
}

const spawnOptions = {
  cwd: resolve(scriptDir, '../..'),
  stdio: 'inherit',
  shell: false,
};

const result = isWindows
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'call', launcher, mode], spawnOptions)
  : spawnSync('bash', [launcher, mode], spawnOptions);

process.exit(result.status ?? 1);
