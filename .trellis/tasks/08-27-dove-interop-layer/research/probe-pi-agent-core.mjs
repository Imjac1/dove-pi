// 验证 pi-agent-core 可独立跑通 + beforeToolCall 真能拦 + transformContext 真能注入
// 运行: cd <dove-pi>; node .trellis/tasks/08-27-dove-interop-layer/research/probe-pi-agent-core.mjs
// 说明: dove-pi 只直接依赖 pi-coding-agent / pi-tui；pi-agent-core 与 pi-ai 是 pi-coding-agent 的
//       嵌套依赖（0.84.3），裸 import 解析不到，故按脚本位置推导出嵌套路径后直接 import 文件。
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const nested = join(repoRoot, 'node_modules', '@earendil-works', 'pi-coding-agent', 'node_modules', '@earendil-works');
const hoisted = join(repoRoot, 'node_modules', '@earendil-works');

async function loadPi() {
  for (const base of [hoisted, nested]) {
    const coreFile = join(base, 'pi-agent-core', 'dist', 'index.js');
    const aiFile = join(base, 'pi-ai', 'dist', 'index.js');
    if (existsSync(coreFile) && existsSync(aiFile)) {
      console.log('resolved Pi packages from: ' + base);
      return {
        core: await import(pathToFileURL(coreFile).href),
        ai: await import(pathToFileURL(aiFile).href),
      };
    }
  }
  throw new Error('未找到 pi-agent-core / pi-ai，请先 npm ci。尝试过: ' + hoisted + ' | ' + nested);
}
const { core, ai } = await loadPi();
const { Agent } = core;
const { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall } = ai;
const { Type } = await import('typebox');

async function run(withGate) {
  let executed = 0;
  const tool = {
    name: 'danger_write', label: 'DW', description: 'mutating action stand-in',
    parameters: Type.Object({ path: Type.String() }),
    execute: async () => { executed += 1; return { content: [{ type: 'text', text: 'WROTE' }], details: {} }; },
  };
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall('danger_write', { path: 'x.txt' })]),
    fauxAssistantMessage('final answer'),
  ]);
  const captured = [];
  let transformCalls = 0;
  const INJECT = '[dove-state] objective=probe; authorization=missing';
  const options = {
    initialState: { systemPrompt: 'probe', model: faux.getModel(), tools: [tool] },
    streamFn: async (m, ctx, o) => { captured.push(ctx); return models.streamSimple(m, ctx, o); },
    transformContext: async (messages) => { transformCalls += 1; return [...messages, { role: 'user', content: [{ type: 'text', text: INJECT }] }]; },
  };
  if (withGate) {
    options.beforeToolCall = async ({ toolCall }) =>
      toolCall.name === 'danger_write' ? { block: true, reason: 'authorization-missing:no RoE file' } : undefined;
  }
  const agent = new Agent(options);
  await agent.prompt('please write the file');
  const flat = JSON.stringify(agent.state.messages);
  return { withGate, toolExecuted: executed, transformCalls, requests: captured.length,
    injectedIntoRequest: JSON.stringify(captured[1] ?? {}).includes(INJECT),
    blockReasonInTranscript: flat.includes('authorization-missing'),
    reachedSecondResponse: flat.includes('final answer') };
}

const without = await run(false);
const withGate = await run(true);
console.log('WITHOUT gate:', JSON.stringify(without));
console.log('WITH    gate:', JSON.stringify(withGate));
console.log('');
console.log('VERDICT gate blocks       :', without.toolExecuted > 0 && withGate.toolExecuted === 0);
console.log('VERDICT reason reaches LLM:', withGate.blockReasonInTranscript);
console.log('VERDICT context injected  :', withGate.injectedIntoRequest);
