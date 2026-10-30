import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = buildApp({ config });
try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`MultiGrizz backend listening at http://${config.host}:${config.port}; inference=local`);
} catch {
  console.error('Backend startup failed. Check configuration and port availability.');
  process.exitCode = 1;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => { await app.close(); process.exit(0); });
}
