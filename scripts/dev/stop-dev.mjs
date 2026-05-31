import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const launcher = resolve(scriptDir, isWindows ? 'stop-dev.bat' : 'stop-dev.sh');

const spawnOptions = {
  cwd: resolve(scriptDir, '../..'),
  stdio: 'inherit',
  shell: false,
};

const result = isWindows
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'call', launcher], spawnOptions)
  : spawnSync('bash', [launcher], spawnOptions);

process.exit(result.status ?? 1);
