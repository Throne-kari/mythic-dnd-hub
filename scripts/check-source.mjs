import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

// Syntax only: do not start games, read runtime files or call external services.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = ['server.mjs', 'manager.mjs'];
async function collect(relative) {
  for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.') || ['node_modules', 'runtime', 'assets', 'data', 'content', 'docs', 'manuscript'].includes(entry.name)) continue;
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) await collect(next);
    else if (/\.(?:mjs|js)$/.test(entry.name)) files.push(next);
  }
}
for (const directory of ['server', 'public', 'scripts', 'games']) await collect(directory);
for (const file of files.sort()) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--check', file], {cwd: root, stdio: ['ignore', 'inherit', 'inherit']});
    child.once('error', reject); child.once('exit', resolve);
  });
  if (code !== 0) { process.exitCode = 1; break; }
}
if (!process.exitCode) console.log(`Syntax checks passed: ${files.length} source files.`);
