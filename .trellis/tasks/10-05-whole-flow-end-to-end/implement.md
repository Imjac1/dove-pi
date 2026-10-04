# Implement

## 开工前的门 ✗✓✓（**不满足就不开工** ✓）

- [ ] **本仓先绿** ✓✓：`npm run typecheck` **0** ✓ 与 `npm test` 全绿 ✓ —— **今天做不到** ✗✓（`935 / 931 pass / **2 fail** / 2 skip` ✓，**红的是并行窗口正压在 mode 注册与 mount-point 引用上的两处** ✗✓）。**由那一侧先落定** ✓，**本任务不与它并行改同一片** ✗✓。
- [ ] **判分基线先量** ✓：在**已绑定**的克隆里跑项目自己的套件 ✓，记下 `115 passed / 1 failed` ✓（那一条红是我的判分仪器 ✓）。
- [ ] **两个缺口的现状各取一次原文** ✓✓（今天已有 ✓，重跑一次以确认未被并行改动影响 ✓）。

## 步骤（**顺序即依赖** ✓）

1. **缺口 ①：mode 目录相对*扩展*解析** ✓✔
   - 落点：`src/core/work-mode.ts`（`<root>/modes/<name>/` 的根 ✓，`:996` 附近 ✓）。
   - **判据** ✓✓：**扩展状态行**从 `workMode=failed` ✓ 变成 **`workMode=code-development`** ✓ —— **不是我推断** ✓。
2. **缺口 ① 的保底** ✓：拒绝文本里写出**找过的路径** ✓（下一次读数自带答案 ✓）。
3. **缺口 ②：工具面进读数** ✓
   - 落点：`src/pi-adapter/extension.ts` 的状态行（`:1172` 附近 ✓）+ §4 读数格式收下它 ✓。
   - **判据** ✓✓：`hashline` 工具在场时分不出差别 ✓；缺失时**读数里有一行** ✓，而不是只有一条 notify ✗。
4. **一条命令跑完整条流程** ✓：安装 ✓ → 绑定 ✓ → 声明 mode ✓ → 干活 ✓ → 判分 ✓ → 收敛 ✓ → 归档 ✓，**同一次运行里各步都留痕** ✓。
5. **写读数** ✓✓：**形状对照**（§3 ✓）· 账本累计量 ✓ · 判分结果 ✓ —— 并**列出哪些与上一轮不可比** ✓。

## 验证命令 ✓

```bash
npm run typecheck                      # 必须 0
npm test                               # 必须全绿（开工前的门 ✗✓）
pip install -e ".[filecache,redis]"    # 被测项目自己的声明（八步里的最后一步 ✓✓）
python -m pytest -q                    # 在运行器那份副本里跑 —— 判分的唯一来源 ✓
node scripts/real-dove-blackbox.mjs --launcher source --provider real \
  --cwd <已绑定的项目> --scenario tests/fixtures/scenarios/immutable-directive-work.json \
  --output <仓外>\run.jsonl --timeout-ms 900000
```

**不用的判据** ✗：**退出码**（同一命令给过 -1 / 1 / 0 ✓）· **`summary` 的 `resources`**（单条记录的详情 ✓）· **field run 对"活做得对不对"的回答**（§5 ✓）。

## 风险文件与回滚点 ✓

| 文件 | 为什么碰它 | 回滚 |
|---|---|---|
| `src/core/work-mode.ts` | mode 的根解析 ✓ | 单点 ✓，独立回滚 ✓ |
| `src/pi-adapter/extension.ts` | 状态行（工具面 ✓） | 单点 ✓ |
| `scripts/real-dove-blackbox.mjs` | **只在必要时**（运行器传 mode 根那条路 ✓）—— **优先不动** ✗✓ | 不碰即无需回滚 ✓ |

## 开工前的追问检查 ✓

- [ ] `prd.md` 的 AC 与 `design.md` 的选法**一一对应** ✓（mode ✓ / 工具面 ✓ / 判分 ✓ / 累计量 ✓）。
- [ ] **并行的窗口**是否已落定它那两处红 ✓✓（**否则先等** ✗✓）。
- [ ] 判分仪器**仍然是红的** ✓（若它绿了，说明活已经被干过 ✓，那就换一个判分点 ✓）。
