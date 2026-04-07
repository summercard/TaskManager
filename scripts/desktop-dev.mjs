import { spawn } from 'node:child_process';
import process from 'node:process';

const DEV_SERVER_URL = 'http://127.0.0.1:5173';
const ELECTRON_ENTRY = 'electron/main.cjs';

let viteProcess;
let electronProcess;
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  electronProcess?.kill('SIGTERM');
  viteProcess?.kill('SIGTERM');
  process.exit(exitCode);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDevServer(retries = 60) {
  for (let index = 0; index < retries; index += 1) {
    try {
      const response = await fetch(DEV_SERVER_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore connection errors while Vite is booting.
    }

    await wait(500);
  }

  throw new Error(`开发服务器未能在预期时间内启动：${DEV_SERVER_URL}`);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

viteProcess = spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--strictPort', '--open', 'false'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

viteProcess.on('exit', (code) => {
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});

await waitForDevServer();

electronProcess = spawn(
  'npx',
  ['electron', ELECTRON_ENTRY],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
    },
  }
);

electronProcess.on('exit', (code) => {
  shutdown(code ?? 0);
});
