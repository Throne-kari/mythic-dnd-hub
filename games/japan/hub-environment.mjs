import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// The hub supplies an isolated persistent directory; published story data stays read-only.
// Direct author CLI tools use that same default instead of creating data beside source files.
const gameRoot = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(gameRoot, '../..');
if (!process.env.HUB_DATA_DIR && fs.existsSync(path.join(hubRoot, 'catalog.json'))) {
  const gameId = path.basename(gameRoot) + (process.argv.includes('--mode=hosted') ? '-hosted' : '');
  process.env.HUB_DATA_DIR = path.join(path.resolve(hubRoot, process.env.HUB_RUNTIME_DIR || 'runtime'), gameId);
}
if (process.env.HUB_DATA_DIR) {
  const data = path.resolve(process.env.HUB_DATA_DIR);
  process.env.ROOMS_DIR = path.join(data, 'rooms');
  process.env.RUNTIME_FILE = path.join(data, 'runtime.json');
  process.env.RUNTIME_DIR = data;
  process.env.MESO_DATA_DIR = data;
  process.env.AZTEC_DATA_DIR = data;
  process.env.FENGSHEN_V03_ROOMS_DIR = process.env.ROOMS_DIR;
  process.env.FENGSHEN_V03_RUNTIME_FILE = process.env.RUNTIME_FILE;
}
if (process.env.PORT) process.env.FENGSHEN_V03_PORT = process.env.PORT;
if (process.env.HOST) process.env.FENGSHEN_V03_HOST = process.env.HOST;
