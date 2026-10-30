import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Existing Render services use `npm run check` as their build command.
// Install locked MCP runtime packages at build time only, never in a request.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lockHash = createHash('sha256').update(fs.readFileSync(path.join(root, 'server/mcp/package-lock.json'))).digest('hex');
const stamp = path.join(root, 'server/mcp/node_modules/.mythic-lock-sha256');
const installedHash = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8') : '';
if (process.env.RENDER === 'true' && (installedHash !== lockHash || !fs.existsSync(path.join(root, 'server/mcp/node_modules/@modelcontextprotocol/server/package.json')))) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--prefix', 'server/mcp'], {cwd: root, stdio: 'inherit'});
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  fs.writeFileSync(stamp, lockHash);
}
