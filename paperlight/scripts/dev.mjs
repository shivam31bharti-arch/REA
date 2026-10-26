import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const server = await createServer();
await server.listen();
server.printUrls();

const devUrl = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5190/';
const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, PAPERLIGHT_DEV_URL: devUrl },
});

electron.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
