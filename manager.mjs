import { startHub } from './server/hub.mjs';

await startHub({ management: true });
