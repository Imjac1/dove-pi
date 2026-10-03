# 执行清单

**先写下"它要解决的活"，再用那件活验收** ✓ —— AC-2 就是上一轮**在三个模式之下都做不了**的那一件 ✓✓（`index.js:62` 的过期 TODO ✓，草稿克隆里 ✓）。

## 有序切片

1. [ ] **能力名不编** ✓：已量 ✓（`capability list` 14 个 ✓）→ 写入 `authority.capabilities` 的**每一个名字都必须真实存在** ✓；本模式自有的动作名（`source.read`/`source.write` ✓）**只在 `governance.yaml`** ✓（`authority.capabilities` + `effects.classes` ✓）—— `permissions.yaml` **声明不了动作名** ✗（`PERMISSION_FIELDS` 实测 ✓）。
2. [ ] **`MODE.md`** ✓：frontmatter（`name`/`description`/`license`/**`compatibility`** ✓）+ Method / Output / Stop ✓；`compatibility` 写明**是什么 contained 了它** ✓ + **精确措辞**（"无 Pi 网络工具" ✓ ≠ "无法访问网络" ✗）+ 前置与代价 ✓。
3. [ ] **`governance.yaml`** ✓：`version` ✓ · `framework: ">=0.2.0 <0.3.0"` ✓ · `scope{targets:[repository],environment:non-production,exclusions:[]}` ✓ · `authority{capabilities:[…真实名字…]}` ✓ · `gate{semantics:none}` ✓ · `effects{classes{source.write: idempotent, write: idempotent, …}}` ✓ · `sandbox{network:none,filesystem:unrestricted}` ✓ · `session{budget{turns:40}}` ✓ · `stop{on:[maxTurns,completed]}` ✓。**不放**任何解析不到的名字 ✗、**不放** `expires`/`approval`/`memory_scope`/`evidence`/`coordination` ✗（加载器按名拒绝 ✓）。
4. [ ] **`permissions.yaml`** ✓：`unlisted: allow` ✓ · `ask_before: []` ✓ · **`never_allow` 点名那 8 个真实工具** ✓（`web_search` ✓ `fetch_content` ✓ `get_search_content` ✓ `source_check` ✓ `browser` ✓ `agent_browser` ✓ `mcp` ✓ `mcpScript` ✓ —— 取自 `action-policy.ts:20` ✓）。**不许出现匹配不到任何东西的项** ✗（`code-audit` 的 `network.*` 就是反例 ✓）。
5. [ ] **AC-1 加载** ✓：在草稿克隆里声明它 ✓ → **能加载** ✓（不被 gate/authority/sandbox 拒绝 ✓）。
6. [ ] **AC-2 真活验收** ✓（**本任务的核心** ✓）：真宿主 + 真模型 ✓ 在克隆里做 `index.js:62` 那件事 ✓ → **改对** ✓ + **项目自己的判分绿** ✓（`ava` ✓ + `tsd` ✓）。**这就是"它真的解决了 Q1"的判据** ✓。
7. [ ] **AC-4 反面** ✗：在它下面试一个**该被拦的**动作 ✓（例如 `browser` 一类网络工具 ✓）→ **必须被拦** ✓ —— 一个"什么都允许"的模式**不是**目的 ✓。
8. [ ] **AC-3 没有放松既有模式** ✓：重测 `code-audit` 仍挡写 ✓ + `pentest` 仍拒绝 pre-flight ✓。
9. [ ] **收尾** ✓：三分门（typecheck ✓ / `npm test` ✓ / installer ✓）+ 模式相关套件 ✓ + **全范围检查** ✓（本会话的老规矩：它每次都有产出 ✓）。

## 验证

```
npm run typecheck        # 0
npm test                 # 0 fail（模式相关套件尤其）
npm run test:installer   # OK
# 并用本任务自己的活验一遍：
#   草稿克隆 + .dove/mode.json = {"schemaVersion":1,"mode":"code-development"}
#   → 真回合 → diff 是那条 TODO 的改法 → ava / tsd 绿
```

## 风险与回退点

- **风险** ✗：把 `never_allow` 写成匹配不到的东西 ✓ → 用**第 4 片**的真实名字清单挡住 ✓。
- **风险** ✗：把 `network: none` 说成"无法访问网络" ✓ → `MODE.md` 措辞按第 2 片写 ✓（代码自己区分了"工具边界"与"shell 出去的能力" ✓✓）。
- **风险** ✗：让模式"什么都能干" ✓ → AC-4 测反面 ✓。
- **回退** ✓：删 `modes/code-development/` 即回退 ✓；不碰任何既有文件 ✓（除本任务目录 ✓）。

## 提交前

- [ ] `authority.capabilities` 里**每一个**名字都真实 ✓（`capability list` 或本模式权限表都能查到 ✓）
- [ ] `never_allow` 里**每一个**名字都真实 ✓
- [ ] `MODE.md` 的 `compatibility` **没有**说超出运行时能力的承诺 ✗
- [ ] AC-2 有**真实回合 + 项目自身判分**为证 ✓（不是"应该能行" ✗）
- [ ] 既有模式**行为未变** ✓（AC-3 实测 ✓）
