#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import http from 'node:http';

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 5173;
const STANDARD_ORIGIN = 'http://localhost:18730';

function readArgValue(name, fallback) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));

  return arg ? arg.slice(name.length + 1) : fallback;
}

function readPort() {
  const rawPort = readArgValue('--port', process.env.LEGACY_WEB_PORT);
  const parsedPort = Number.parseInt(rawPort ?? `${DEFAULT_PORT}`, 10);

  return Number.isInteger(parsedPort) && parsedPort > 0
    ? parsedPort
    : DEFAULT_PORT;
}

function readHost() {
  return readArgValue('--host', process.env.LEGACY_WEB_HOST) ?? DEFAULT_HOST;
}

const legacyBridgeHtml = readFileSync(
  new URL('./export-legacy-origin.html', import.meta.url),
  'utf8',
);
const host = readHost();
const port = readPort();
const server = http.createServer((request, response) => {
  if (request.method !== 'GET') {
    response.writeHead(405, {
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('Method not allowed');
    return;
  }

  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(legacyBridgeHtml);
});

server.on('error', (error) => {
  console.error(`Legacy origin export bridge failed: ${error.message}`);
  console.error(
    'Stop any server already using the legacy port, then run this command again.',
  );
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const legacyOrigin = `http://${host}:${port}`;

  console.log('Work Archive legacy origin export bridge is running.');
  console.log(`Legacy origin: ${legacyOrigin}`);
  console.log(`Standard app:  ${STANDARD_ORIGIN}`);
  console.log('');
  console.log(`Open ${legacyOrigin} in the browser profile that has old data.`);
  console.log(
    `Download the JSON file, then import it from ${STANDARD_ORIGIN}/account/settings.`,
  );
  console.log('Press Ctrl+C to stop.');
});
