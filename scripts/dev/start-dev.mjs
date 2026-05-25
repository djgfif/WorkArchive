import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const launcher = resolve(scriptDir, isWindows ? 'start-dev.bat' : 'start-dev.sh');
const args = isWindows ? [launcher, ...process.argv.slice(2)] : [launcher, ...process.argv.slice(2)];
const command = isWindows ? 'cmd.exe' : 'bash';
const commandArgs = isWindows ? ['/d', '/s', '/c', `"${args.join('" "')}"`] : args;

const result = spawnSync(command, commandArgs, {
  cwd: resolve(scriptDir, '../..'),
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
