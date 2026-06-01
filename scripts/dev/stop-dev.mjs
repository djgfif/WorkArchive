import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '../..');
const isWindows = process.platform === 'win32';

const spawnOptions = {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
};

const result = isWindows
  ? spawnSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'call', 'scripts\\dev\\stop-dev.bat'],
      spawnOptions,
    )
  : spawnSync('bash', ['scripts/dev/stop-dev.sh'], spawnOptions);

process.exit(result.status ?? 1);
