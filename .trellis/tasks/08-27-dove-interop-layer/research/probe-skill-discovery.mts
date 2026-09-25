// 复现：discoverSkills 的行为依赖项目在磁盘上的位置（见 check-2026-09-25-skill-discovery.md）
// 运行: cd <dove-pi>; node --import tsx .trellis/tasks/08-27-dove-interop-layer/research/probe-skill-discovery.mts
import { discoverSkills } from '../../../../src/skills/discovery.ts';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function probe(label: string, base: string) {
  const root = await mkdtemp(join(base, 'dove-probe-'));
  await mkdir(join(root, '.agents', 'skills', 'local-only'), { recursive: true });
  await writeFile(join(root, '.agents', 'skills', 'local-only', 'SKILL.md'), '---\ndescription: local\n---\n');
  const skills = discoverSkills(root);
  console.log(label + '  count=' + skills.length + '  names=' + JSON.stringify(skills.map(s => s.name)));
  console.log('   root: ' + root);
  for (const s of skills) if (!s.sourceRoot.startsWith(root)) console.log('   INHERITED: ' + s.name + '  <-  ' + s.sourceRoot);
}

await probe('C: (under user home) ', 'C:\\Users\\Macfy\\AppData\\Local\\Temp');
try {
  await mkdir('D:\\_dove_probe', { recursive: true });
  await probe('D: (other drive)    ', 'D:\\_dove_probe');
} catch (e) { console.log('D: probe skipped: ' + (e as Error).message); }
