import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const launcher = resolve(scriptDir, isWindows ? 'stop-dev.bat' : 'stop-dev.sh');
const command = isWindows ? 'cmd.exe' : 'bash';
const commandArgs = isWindows ? ['/d', '/s', '/c', `"${launcher}"`] : [launcher];

const result = spawnSync(command, commandArgs, {
  cwd: resolve(scriptDir, '../..'),
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
