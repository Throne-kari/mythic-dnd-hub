import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, '.local', 'pages');
const deployment = JSON.parse(await fs.readFile(path.join(root, 'deployment.json'), 'utf8'));
const backend = deployment.backendUrl ? new URL(deployment.backendUrl) : null;
const ephemeralStorage = deployment.ephemeralStorage === true;
if (backend && (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash)) throw Error('An HTTPS backend origin without credentials, path, query or fragment is required.');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.cp(path.join(root, 'public'), output, { recursive: true });
const index = await fs.readFile(path.join(output, 'index.html'), 'utf8');
await fs.writeFile(path.join(output, 'index.html'), index
  .replace(/(src|href)="\/(?!\/)/g, '$1="./')
  .replace('<script type="module"', '<script src="./deployment.js"></script>\n  <script type="module"')
  .replace('  <main ', `${!backend ? '  <aside id="connection-status" class="connection-status" role="status"><strong>联机尚未启用。</strong> 当前仅提供书库与资料，暂不能创建或加入游戏。</aside>\n' : ephemeralStorage ? '  <aside id="storage-status" class="connection-status" role="note"><strong>免费临时联机版。</strong> 空闲后会休眠，首次访问可能需要约一分钟唤醒；休眠、重启或部署会清空房间和存档，请勿用于长期存档。</aside>\n' : ''}  <main `));
await fs.writeFile(path.join(output, 'deployment.js'), `window.__MYTHIC_DEPLOYMENT__=Object.freeze(${JSON.stringify({ backendUrl: backend?.origin || null, catalogUrl: './catalog.json', ephemeralStorage })});\n`);
const keys = ['id','pantheon','title','subtitle','version','status','players','tags','description','cover','chapters','setting','mode','features','contentRating','engine','series','docs'];
await fs.writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog.map(game => Object.fromEntries(keys.filter(key => game[key] !== undefined).map(key => [key, game[key]]))), null, 2));
// Only the catalog's published documents and their static documentation assets are copied.
const allowed = new Set(['.md','.txt','.pdf','.png','.jpg','.jpeg','.webp','.gif','.avif','.svg']);
for (const game of catalog) {
  const source = path.resolve(root, game.directory), target = path.join(output, 'docs', game.id);
  const walk = async (directory, relative = '') => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.') || /^(runtime|rooms|saves|credentials|secrets|node_modules|data)(?:$|[-_.])/i.test(entry.name)) continue;
      const rel = path.join(relative, entry.name);
      if (entry.isDirectory()) { if (['docs','manuscript','public'].includes(rel.split(path.sep)[0])) await walk(path.join(directory, entry.name), rel); }
      else if (allowed.has(path.extname(entry.name).toLowerCase())) { await fs.mkdir(path.dirname(path.join(target, rel)), { recursive: true }); await fs.copyFile(path.join(source, rel), path.join(target, rel)); }
    }
  };
  await walk(source);
}
await fs.writeFile(path.join(output, '.nojekyll'), '');
console.log(`Pages artifact: ${output}; ${catalog.length} games; backend ${backend?.origin || 'not connected (library and documents only)'}`);
