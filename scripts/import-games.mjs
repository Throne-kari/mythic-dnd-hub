import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Maintainer utility: import the selected published editions from an author archive.
// No source archive or personal runtime data is needed to run the published hub.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg = process.argv.indexOf('--source-root');
const gameArg = process.argv.indexOf('--game');
const selectedId = gameArg >= 0 ? process.argv[gameArg + 1] : null;
const update = process.argv.includes('--update');
const sourceRoot = sourceArg >= 0 && process.argv[sourceArg + 1] ? path.resolve(process.argv[sourceArg + 1]) : null;
const localSourcesFile = path.join(root,'author-sources.local.json');
const localSources = fs.existsSync(localSourcesFile) ? JSON.parse(fs.readFileSync(localSourcesFile,'utf8')) : {version:1,games:{}};
if (!sourceRoot && !selectedId && !update) {
  console.log('Import: node scripts/import-games.mjs --source-root <author-archive-directory>\nUpdate a stopped game: node scripts/import-games.mjs --game <id> --update\nUpdate all stopped games: node scripts/import-games.mjs --update');
  process.exit(0);
}
const selections = [
  {id:'fengshen',pantheon:'中国神话',title:'封神·岐路',subtitle:'世路人情',version:'0.3',players:'4 人＋主持',mode:'主持＋玩家',chapters:'六幕十二回',tags:['封神','成长战役','抉择'],description:'从朝歌走向封神之战，四名同行者在粮药、盟约与人情之间，走完六幕十二回。',defaultPort:8811,source:'神话DND/中国神话_封神岐路_v0.3_世路人情',docPaths:[['玩家须知','docs/玩家须知_世路人情.md'],['主持增补','docs/主持增补_世路人情.md'],['AI 接入','AI_DM_GUIDE.md']]},
  {id:'japan',pantheon:'日本神话',title:'镜与归路',subtitle:'暗潮归灯',version:'2.0',players:'4 人＋主持',mode:'主持＋玩家',chapters:'十二节点 · 四类结局',tags:['海岸','归返','证言'],description:'借船渡潮，找回被托付的证言。救下的人与许下的约定，将改变归返的路。',defaultPort:8799,source:'神话DND/日本神话_镜与归路_v2_暗潮归灯',docPaths:[['玩家简报','docs/source/PLAYER_BRIEF.md'],['主持正文','docs/source/GM_SESSION.md'],['AI 接入','AI_DM_GUIDE.md']]},
  {id:'india',pantheon:'印度神话',title:'乳海余波',subtitle:'甘露的代价',version:'2.0',players:'4 人＋主持',mode:'主持＋玩家',chapters:'十二节点 · 四类结局',tags:['夜潮','救援','债册'],description:'夜潮中撤离，工伤债册与救命药握在手中。每一次交接，都决定谁能获得下一份援手。',defaultPort:8800,source:'神话DND/印度神话_乳海余波_v2_甘露代价',docPaths:[['玩家简报','PLAYER_BRIEF.md'],['主持正文','GM_SESSION.md'],['AI 接入','AI_DM_GUIDE.md']]},
  {id:'norse',pantheon:'北欧神话',title:'断誓之冬',subtitle:'盐峡湾',version:'3.2',players:'1–4 人',mode:'无需主持',chapters:'三章 · 56 场景 · 24 结局',tags:['合作','寒冬','誓言'],description:'在盐峡湾的漫长寒冬里，追寻死者证词、守住迁徙者的家园，决定港口权力的归属。',defaultPort:18842,source:'北欧_断誓之冬_v3.2_默认合作免主持_独立版_2026-10-21',docPaths:[['游玩指南','docs/PLAY_GUIDE.md'],['规则','docs/RULES.md'],['智能体协议','docs/PROTOCOL.md']]},
  {id:'mesopotamia',pantheon:'美索不达米亚',title:'七门之债',subtitle:'吉尔伽美什核心篇',version:'3.2',players:'1–4 人',mode:'无需主持',chapters:'三章 · 27 节点 · 24 结局',tags:['合作','王权','亡途'],description:'水、名字与死债纠缠在纳鲁渡。与吉尔伽美什交涉，决定一座城如何度过第七门。',defaultPort:8845,source:'美索不达米亚_七门之债_队伍共游_v3.2_2026-10-21',docPaths:[['合作指南','docs/COOP.md'],['规则','docs/RULES.md'],['剧情','docs/STORY.md'],['智能体协议','docs/AGENT_PROTOCOL.md']]},
  {id:'greek',pantheon:'希腊神话',title:'无葬之城',subtitle:'城门未闭',version:'1.0',players:'1–4 人＋可选主持',mode:'主持＋玩家',chapters:'四章 · 36 阶段 · 24 结局',tags:['城邦','葬仪','神谕'],description:'葬仪、粮路与被删改的神谕，织成爱琴海城邦的最后四章。封港之前，你们将把城交给谁？',defaultPort:8841,source:'希腊神话_无葬之城_四章独立版_v1_20261020T172045Z/game',docPaths:[['玩家说明','docs/PLAYER_GUIDE.md'],['主持指南','docs/STORY_GUIDE.md'],['智能体协议','docs/AGENT_PROTOCOL.md']]},
  {id:'celtic',pantheon:'凯尔特神话',title:'荆冠与归潮',subtitle:'七夜之外',version:'1.0',players:'1–4 人',mode:'无需主持',chapters:'三章 · 52 场景 · 24 结局',tags:['合作','异界','誓禁'],description:'荆冠下的土地需要供养，异界归来的人错过了一生。四名英雄穿过归潮，寻找自己的名字。',defaultPort:18846,source:'凯尔特神话_荆冠与归潮_v1',docPaths:[['规则','docs/RULES.md'],['战役','docs/CAMPAIGN.md'],['人物','docs/CHARACTERS.md'],['AI 队友','AI_PLAYER_GUIDE.md']]},
  {id:'aztec',pantheon:'阿兹特克神话',title:'第五日之城',subtitle:'湖田、烟镜与亡途',version:'3.0',status:'ready',players:'1–4 人',mode:'无需主持',chapters:'三章 · 27 节点 · 24 结局',tags:['合作','湖城','太阳'],description:'湖田、烟镜与亡者归途交织成第五日之城。与四名同伴踏过湖港，决定太阳与活城的明日。',defaultPort:8856,source:'阿兹特克_第五日之城_v3_合作独立版_2026-10-23',docPaths:[['玩家指南','docs/PLAYER_GUIDE.md'],['世界','docs/WORLD.md'],['智能体协议','docs/AGENT_PROTOCOL.md']]},
  {id:'jaffa',pantheon:'历史虚构',title:'雅法余烬',subtitle:'夜火余账',version:'3.0',players:'4 人＋主持',mode:'主持＋玩家',chapters:'六景 · 六类结局',tags:['港城','救援','历史虚构'],description:'盐仓火后，救援尚未结束。欠薪、床粮、证据与炉火的归属，等待你们在天亮前作答。',defaultPort:8812,source:'历史虚构DND/十字军东征_雅法余烬_v3_夜火余账',docPaths:[['玩家指南','docs/PLAYER_NIGHT_ACCOUNTS.md'],['主持补篇','docs/GM_NIGHT_ACCOUNTS.md'],['AI 接入','AI_DM_GUIDE.md']]},
  {id:'qchina',pantheon:'中国神话',title:'三册异途',subtitle:'中国神话三弧',version:'2.0',players:'4 人＋主持',mode:'主持＋玩家',chapters:'三弧 · 13 节点',tags:['独立短篇','契约','三弧'],description:'三条可分别开团的故事，从文书、约定与受托之物出发，各自抵达不同的归路。',defaultPort:8829,source:'成人叙事扩展_2026-10-20/增强版/千问中国_三弧_v2/game',manuscript:'成人叙事扩展_2026-10-20/增强版/千问中国_三弧_v2',docPaths:[['玩家本','manuscript/rules/PLAYER_PACKET.md'],['主持本','manuscript/rules/READING_DRAFT.md'],['分批手札','manuscript/rules/HANDOUTS.md']]},
  {id:'qjapan',pantheon:'日本神话',title:'日本神话三弧',subtitle:'五名之主 · 携云的匣 · 可畏者的登录',version:'2.1',players:'4 人＋主持',mode:'主持＋玩家',chapters:'三弧 · 13 节点',tags:['独立短篇','姓名','归返'],description:'《五名之主》《携云的匣》《可畏者的登录》：在归返、署名与祭期之间，留下自己的决定。',defaultPort:8827,source:'成人叙事扩展_2026-10-20/增强版/千问日本_三弧_v2/game',manuscript:'成人叙事扩展_2026-10-20/增强版/千问日本_三弧_v2',docPaths:[['玩家本','manuscript/PLAYER_PACKET.md'],['主持本','manuscript/READING_DRAFT.md'],['主持手札','manuscript/GM_HANDOUTS.md']]},
  {id:'qindia',pantheon:'印度神话',title:'印度神话三弧',subtitle:'十四年与一个承诺 · 分甘之约 · 未赴的席',version:'2.1',players:'4 人＋主持',mode:'主持＋玩家',chapters:'三弧 · 13 节点',tags:['独立短篇','承诺','离别'],description:'《十四年与一个承诺》《分甘之约》《未赴的席》：面对约定、劳务与离别，选择一条仍能继续的路。',defaultPort:8828,source:'成人叙事扩展_2026-10-20/增强版/千问印度_三弧_v2/game',manuscript:'成人叙事扩展_2026-10-20/增强版/千问印度_三弧_v2',docPaths:[['玩家本','manuscript/PLAYER_PACKET.md'],['主持本','manuscript/READING_DRAFT.md'],['主持手札','manuscript/GM_SCRIPT_AND_HANDOUTS.md']]},
  {id:'acre',pantheon:'历史虚构',title:'阿卡账房',subtitle:'围城中的交接',version:'2.0',players:'4 人＋主持',mode:'主持＋玩家',chapters:'三时段 · 12 节点',tags:['围城','账房','历史虚构'],description:'阿卡围城中的十二个节点。豆粮、船位与人的去留，都写在一张不能替别人签名的交接单上。',defaultPort:8831,source:'成人叙事扩展_2026-10-20/增强版/阿卡账房_长期框架切片_v2/game',manuscript:'成人叙事扩展_2026-10-20/增强版/阿卡账房_长期框架切片_v2',docPaths:[['玩家本','manuscript/docs/PLAYER_PACKET.md'],['主持本','manuscript/docs/GM_ACRE_LEDGER.md'],['后果矩阵','manuscript/docs/CONSEQUENCE_MATRIX.md']]},
];

const excludedSegments = /^(?:\.git|node_modules|data|runtime|qa|tests?|evidence|baseline|original|source_snapshot|reference_public|sources|design|dist|delivery|__pycache__|\.qa.*|\.backup.*)$/i;
const excludedName = /(?:^AGENTS\.md$|^TASK_LOCK|^TEAM-CONTRACT|^CONTRACT|^DEPLOY|MANIFEST|BASELINE|CHECK|VERIF|VALIDATION|ACCEPTANCE|DELIVERY|RELEASE|QA|EVIDENCE|AUDIT|REVIEW|REPORT|source-preservation|ending-witnesses|交付说明|验证说明|静态核对|先从这里开始|先读这里|\.log$|\.zip$|\.tap$|\.bak$|\.env|runtime|token|credential)/i;
const staticData = new Set(['campaign.json','handouts.json','srd-statblocks.json','maps.json','static/rule-statblocks.json']);
const toolNames = new Set(['bridge.mjs','agent-bridge.mjs','agent-client.mjs','api-adapter.mjs','api-adapter-example.mjs','folder-player.mjs','mock-api.mjs']);
const textExt = new Set(['.md','.txt','.mjs','.js','.json','.html','.css','.svg','.obj','.mtl','.csv']);
const allowedExt = new Set([...textExt,'.png','.jpg','.jpeg','.webp','.gif','.avif','.ico','.woff','.woff2','.glb','.gltf','.bin','.pdf','.wav','.mp3']);
const within = (base, target) => target === base || target.startsWith(base + path.sep);
const gameRoot = path.join(root,'games');
fs.mkdirSync(gameRoot,{recursive:true});

function cleanText(text) {
  // Historical author-machine paths have no meaning in an installable distribution.
  return text.replace(/(?<![A-Za-z])[A-Za-z]:[\\/][^\s`\n\r<>"'|)\]}，；。]+/g, '<本地目录>')
    .replace(/\/(?:mnt\/data|Users\/[^/\s]+|home\/[^/\s]+)\/[^\s`\n\r<>"'|)\]}，；。]*/g, '<本地目录>')
    .replace(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi, '<PUBLIC_URL>')
    .replace(/node tools\/start(?:-lan)?\.mjs/g, 'node server.mjs')
    .replace(/双击(?:根目录|本目录)?\s*(?:\*\*)?`[^`]*\.cmd`(?:\*\*)?/g, '运行 `node server.mjs`');
}

function copyTree(source, destination, prefix='', manuscript=false) {
  if (!fs.existsSync(source)) return;
  for (const ent of fs.readdirSync(source,{withFileTypes:true})) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const src = path.join(source,ent.name), dst=path.join(destination,ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (excludedSegments.test(ent.name) || (manuscript && ['game','tools','research'].includes(ent.name))) continue;
      if (rel.startsWith('tools/') || (prefix === '' && ent.name === 'tools')) {
        if (manuscript) continue;
      }
      copyTree(src,dst,rel,manuscript); continue;
    }
    if (!ent.isFile() || excludedName.test(ent.name)) continue;
    const ext=path.extname(ent.name).toLowerCase();
    if (!allowedExt.has(ext) || manuscript && !['.md','.txt'].includes(ext)) continue;
    if (rel.startsWith('docs/') && ext === '.json') continue;
    if (prefix === 'tools' && !toolNames.has(ent.name)) continue;
    if (!prefix && ext === '.json' && ent.name !== 'package.json') continue;
    fs.mkdirSync(path.dirname(dst),{recursive:true});
    if (textExt.has(ext)) fs.writeFileSync(dst,cleanText(fs.readFileSync(src,'utf8')),'utf8');
    else fs.copyFileSync(src,dst);
  }
}

const hubEnvironment = `import fs from 'node:fs';
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
`;

const previousCatalog=fs.existsSync(path.join(root,'catalog.json')) ? JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8')) : [];
const imported=[];
if (selectedId && !selections.some(s=>s.id===selectedId)) throw Error('Unknown game ID');
for (const item of selections.filter(s=>!selectedId || s.id===selectedId)) {
  const mapped=localSources.games?.[item.id];
  const source=sourceRoot ? path.resolve(sourceRoot,item.source) : path.resolve(typeof mapped==='string' ? mapped : mapped?.source || '');
  const dest=path.resolve(gameRoot,item.id);
  if (sourceRoot && !within(sourceRoot,source) || !within(gameRoot,dest)) throw Error('Import path escapes its root');
  if (within(dest,source)) throw Error('The source must be outside its imported copy.');
  if (!sourceRoot && !mapped) throw Error(`No local source configured for ${item.id}`);
  if (!fs.existsSync(path.join(source,'server.mjs'))) throw Error(`Missing game: ${item.id}`);
  if (fs.existsSync(dest) && !update) throw Error(`Destination already exists: ${item.id}. Stop it first, then use --update.`);
  copyTree(source,dest);
  for (const name of staticData) {
    const src=path.join(source,'data',name);
    if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(path.join(dest,'data',name)),{recursive:true}); fs.writeFileSync(path.join(dest,'data',name),cleanText(fs.readFileSync(src,'utf8')),'utf8'); }
  }
  if (['qchina','qjapan','qindia'].includes(item.id)) {
    const campaignFile=path.join(dest,'data','campaign.json');
    const campaign=JSON.parse(fs.readFileSync(campaignFile,'utf8'));
    campaign.title=item.title;
    fs.writeFileSync(campaignFile,JSON.stringify(campaign,null,2)+'\n','utf8');
  }
  if (item.manuscript) copyTree(sourceRoot ? path.join(sourceRoot,item.manuscript) : path.dirname(source),path.join(dest,'manuscript'),'',true);
  fs.writeFileSync(path.join(dest,'hub-environment.mjs'),hubEnvironment,'utf8');
  const bridgeTool=path.join(dest,'tools','bridge.mjs');
  if (fs.existsSync(bridgeTool)) {
    let bridge=fs.readFileSync(bridgeTool,'utf8');
    bridge=`import '../hub-environment.mjs';\n${bridge}`;
    bridge=bridge.replace(/const stopFile=path\.resolve\(root,opts\['stop-file'\]\|\|'data\/([^']+)\/workspace-watch\.stop'\);/, "const stopFile=opts['stop-file']?path.resolve(root,opts['stop-file']):process.env.HUB_DATA_DIR?path.join(process.env.HUB_DATA_DIR,'bridge','workspace-watch.stop'):path.join(root,'data','$1','workspace-watch.stop');");
    bridge=bridge.replace("const modern=path.join(root,'data/runtime-v03.json');", "const modern=path.resolve(process.env.RUNTIME_FILE||path.join(root,'data/runtime-v03.json'));");
    fs.writeFileSync(bridgeTool,bridge,'utf8');
  }
  if (item.id === 'aztec') {
    const playerTool=path.join(dest,'tools','folder-player.mjs');
    let player=fs.readFileSync(playerTool,'utf8');
    player=`import '../hub-environment.mjs';\n${player}`;
    player=player.replace("new URL('/api/rooms/'+encodeURIComponent(options.room)+'/agents',options.url||process.env.AZTEC_URL||'http://127.0.0.1:8856')", "new URL((options.url||process.env.AZTEC_URL||'http://127.0.0.1:8856').replace(/\\/$/,'')+'/api/rooms/'+encodeURIComponent(options.room)+'/agents')");
    fs.writeFileSync(playerTool,player,'utf8');
  }
  let server=fs.readFileSync(path.join(dest,'server.mjs'),'utf8');
  server=`import './hub-environment.mjs';\n${server}`;
  if (['norse','celtic'].includes(item.id)) {
    server=server.replace("dataDir = path.join(ROOT, 'data',", "dataDir = process.env.HUB_DATA_DIR || path.join(ROOT, 'data',");
    server=server.replace(/const port = value \? Number\(value\.slice\(7\)\) : mode === 'hosted' \? (\d+) : (\d+);/,"const port = value ? Number(value.slice(7)) : Number(process.env.PORT || (mode === 'hosted' ? $1 : $2));");
    server=server.replace('createGameServer({port, mode})',"createGameServer({port, mode, host:process.env.HOST || '127.0.0.1'})");
  }
  fs.writeFileSync(path.join(dest,'server.mjs'),server,'utf8');
  if (item.id === 'mesopotamia') {
    const license=path.join(source,'baseline','LICENSES-v2.md');
    if (fs.existsSync(license)) fs.writeFileSync(path.join(dest,'LICENSES.md'),cleanText(fs.readFileSync(license,'utf8')),'utf8');
  }
  const pkg=JSON.parse(fs.readFileSync(path.join(dest,'package.json'),'utf8'));
  pkg.name=`mythic-dnd-${item.id}`;
  pkg.engines={node:'>=24'};
  pkg.scripts={start:'node server.mjs'};
  fs.writeFileSync(path.join(dest,'package.json'),JSON.stringify(pkg,null,2)+'\n','utf8');
  const docs=[{title:'开始游戏',path:'README.md'},...item.docPaths.map(([title,p])=>({title,path:p})).filter(d=>fs.existsSync(path.join(dest,d.path)))];
  if (fs.existsSync(path.join(dest,'LICENSES.md'))) docs.push({title:'来源与许可',path:'LICENSES.md'});
  const note=item.status==='development'?'\n此版本仍在制作，站点将它标为开发中，独立于正式游戏列表。\n':'';
  fs.writeFileSync(path.join(dest,'README.md'),`# ${item.title} · ${item.subtitle}\n\n${item.description}\n\n${item.players}；${item.mode}；${item.chapters}。版本 ${item.version}。${note}\n## 启动\n\n推荐从合集网站进入，作者可在本机管理台启动、停止游戏和管理存档。单独运行需要 Node.js 24 或更新版本，无第三方 npm 依赖。\n\n\`\`\`sh\nnode server.mjs\n\`\`\`\n\n默认地址 http://127.0.0.1:${item.defaultPort} 。终端按 Ctrl+C 停止。可通过 PORT 指定端口。合集内部使用 HOST=127.0.0.1，通过网关提供网站入口。\n\nHUB_DATA_DIR 指定本游戏的独立运行目录，包含房间、存档、席位和智能体文件。在合集目录内直接运行游戏或命令行工具，也默认使用合集 runtime/${item.id}/；HUB_RUNTIME_DIR 可调整合集运行目录。独立移出合集后使用本游戏原有默认数据位置。运行目录不应提交到 Git。游戏内容、规则和素材随源码提供，原作者机器的存档、配置和凭据均不在此发行版中。\n\n## 资料\n\n${docs.slice(1).map(d=>`- [${d.title}](${d.path})`).join('\n')}\n`,'utf8');
  const {source:_,manuscript:__,docPaths:___,...metadata}=item;
  imported.push({...previousCatalog.find(g=>g.id===item.id),...metadata,status:item.status||'ready',directory:`games/${item.id}`,entry:'server.mjs',portEnv:'PORT',hostEnv:'HOST',dataEnv:'HUB_DATA_DIR',docs});
  localSources.games[item.id]={source};
  console.log(`Imported ${item.id}`);
}
const catalog=selections.map(s=>imported.find(g=>g.id===s.id)||previousCatalog.find(g=>g.id===s.id)).filter(Boolean);
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalog,null,2)+'\n','utf8');
fs.writeFileSync(localSourcesFile,JSON.stringify(localSources,null,2)+'\n','utf8');
console.log(`Imported ${imported.length} games. Original folders and runtime data were not modified.`);
