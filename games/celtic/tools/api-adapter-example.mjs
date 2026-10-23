import {providerInput, parseProposal} from '../bridge.mjs';

// Pure, injected boundary only. This file never reads the environment or a key,
// creates a provider client, performs HTTP, or chooses an actual paid service.
export async function proposeWithAdapter(snapshot, adapter) {
  if (typeof adapter !== 'function') throw Error('请显式注入 adapter(input)；此示例没有真实 API 调用。');
  const input = providerInput(structuredClone(snapshot));
  const raw = await adapter(input);
  const proposal = parseProposal(typeof raw === 'string' ? JSON.parse(raw) : raw);
  if (proposal.requestId !== snapshot.requestId || proposal.revision !== snapshot.revision) throw Error('适配器回复与快照不一致。');
  if (proposal.actionIndex !== null && !snapshot.actions[proposal.actionIndex]) throw Error('适配器选择了未列出的行动。');
  return proposal;
}

