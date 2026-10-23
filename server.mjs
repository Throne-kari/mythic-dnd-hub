import { startHub } from './server/hub.mjs';

await startHub({ management: !process.argv.includes('--public-only') && process.env.HUB_MANAGER !== '0' });
