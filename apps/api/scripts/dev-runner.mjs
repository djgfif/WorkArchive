import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceDir = fileURLToPath(new URL('../', import.meta.url));

let expectedExitCode = 0;
let isShuttingDown = false;
const childProcesses = [];

function writePrefixed(target, prefix, line) {
  target.write(`[${prefix}] ${line}`);
}

function pipeWithPrefix(stream, target, prefix) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();

    while (buffer.includes('\n')) {
      const newlineIndex = buffer.indexOf('\n');
      const line = buffer.slice(0, newlineIndex + 1);
      buffer = buffer.slice(newlineIndex + 1);
      writePrefixed(target, prefix, line);
    }
  });

  stream.on('end', () => {
    if (!buffer) {
      return;
    }

    writePrefixed(target, prefix, `${buffer}\n`);
    buffer = '';
  });
}

function getNpmSpawnSpec(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...args],
    };
  }

  return {
    command: 'npm',
    args,
  };
}

function spawnNpmProcess(label, args, extraEnv = {}) {
  const spec = getNpmSpawnSpec(args);
  const child = spawn(spec.command, spec.args, {
    cwd: workspaceDir,
    env: {
      ...process.env,
      ...extraEnv,
    },
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  pipeWithPrefix(child.stdout, process.stdout, label);
  pipeWithPrefix(child.stderr, process.stderr, label);

  return child;
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} exited with ${signal ? `signal ${signal}` : `code ${code ?? 1}`}.`,
        ),
      );
    });
  });
}

function killProcessTree(child) {
  if (child.exitCode !== null || child.killed || !child.pid) {
    return;
  }

  if (process.platform !== 'win32') {
    child.kill('SIGTERM');
    return;
  }

  const killer = spawn(
    'taskkill.exe',
    ['/pid', String(child.pid), '/T', '/F'],
    {
      stdio: 'ignore',
    },
  );

  killer.once('error', () => {
    child.kill('SIGTERM');
  });
}

async function runInitialBuild() {
  const buildProcess = spawnNpmProcess('build:init', ['run', 'build']);
  await waitForExit(buildProcess, 'Initial API build');
}

function spawnWatchProcess(label, scriptName, extraEnv = {}) {
  const child = spawnNpmProcess(label, ['run', scriptName], extraEnv);
  childProcesses.push({ child, label });

  child.once('exit', (code, signal) => {
    if (isShuttingDown) {
      maybeExitParent();
      return;
    }

    const exitCode = code ?? (signal ? 1 : 0);
    const reason = signal ? `signal ${signal}` : `code ${exitCode}`;
    process.stderr.write(`[dev-runner] ${label} stopped with ${reason}.\n`);
    shutdown(exitCode);
  });

  child.once('error', (error) => {
    if (isShuttingDown) {
      maybeExitParent();
      return;
    }

    process.stderr.write(
      `[dev-runner] ${label} failed to start: ${error.message}\n`,
    );
    shutdown(1);
  });
}

function maybeExitParent() {
  if (
    childProcesses.some(({ child }) => child.exitCode === null && !child.killed)
  ) {
    return;
  }

  process.exit(expectedExitCode);
}

function shutdown(code) {
  if (isShuttingDown) {
    if (code !== 0 && expectedExitCode === 0) {
      expectedExitCode = code;
    }
    return;
  }

  expectedExitCode = code;
  isShuttingDown = true;

  for (const { child } of childProcesses) {
    killProcessTree(child);
  }

  setTimeout(() => {
    for (const { child } of childProcesses) {
      killProcessTree(child);
    }
  }, 5_000).unref();

  maybeExitParent();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

try {
  await runInitialBuild();

  spawnWatchProcess('build', 'dev:build');
  spawnWatchProcess('serve', 'dev:serve');
  spawnWatchProcess('health', 'dev:health', {
    API_HEALTH_RESTART_GRACE_MS:
      process.env.API_HEALTH_RESTART_GRACE_MS ?? '30000',
    API_HEALTH_STARTUP_TIMEOUT_MS:
      process.env.API_HEALTH_STARTUP_TIMEOUT_MS ?? '20000',
  });
} catch (error) {
  process.stderr.write(
    `[dev-runner] ${error instanceof Error ? error.message : 'Initial API build failed.'}\n`,
  );
  process.exit(1);
}
