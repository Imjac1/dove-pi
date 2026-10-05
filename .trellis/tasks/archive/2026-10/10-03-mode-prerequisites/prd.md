# A mode's prerequisites are only discovered by being refused

## Goal

Measured: pentest refuses to run twice - DOVE_PI_FRAMEWORK_VERSION unset, and the engagement document it names not resolvable in the workspace. Both are correct fail-closed behaviour and both are invisible before the error; doctor lists machine tools (nmap and hydra null here) without connecting them to a mode that needs them.

## 规划：这个缺陷的**唯一缺口**是哪一条

三例实测里，**两例已经完整**——day-two 的读数（`.trellis/tasks/10-03-day-two-walk/readings.md`）量到：模式停摆时拒绝把**原因链完整送到用户**（模式 → `conformance` → engagement → grant `g-client-scope` → 缺摘要），发现数 0。所以环境变量缺与文档解析不到这两条**不需要再改**。

**缺的是第三例**：模式需要的**机器工具**（这里 `nmap`、`hydra` 都是 null）与 `doctor` 的工具清单**互不相识**——`doctor` 列出来，模式却不知道，于是"这个模式在这台机器上有多少能力是空的"要等到**撞上**才知道。

## Requirements

- **R1 在尝试之前说，而不是在拒绝之后说**：模式加载时，把它需要的东西与 `doctor` 的机器清单对账，缺什么**当场点名**——点**工具**，也点**因此不可用的那条能力**。
- **R2 不改变 fail-closed**：该拒的调用**仍然拒**，拒绝文案不变；新增的只是**提前**说。停机是设计要的行为（day-two 读数第一条），本任务不碰它。
- **R3 不新造字段**：前置条件的声明**已经存在**（`windows.host_info` 在寄存器里声明 `preconditions`）⇒ 本任务是**把它接到模式加载上**，不是发明一个声明机制。
- **R4 必须有可执行判定**：一个用例让"模式需要某工具而 `doctor` 报 null"这一组合**不再无声无息**（与 `network: none` 那条先例同形：声明成立不成立，要有一条会红的东西看着）。
- **R5 不产生噪声**：不声明机器工具的模式（如 `code-development`）加载时，**不新增任何输出**。
- **R6（待你定）拒绝还是警示**：见下。

### R6 需要你一句话（这是产品决定，不是实现细节）

机器工具缺失时，模式加载应当：

- **(a) 警示但照常加载**（推荐）：说"缺 `nmap`，`pentest.probe-network` 会因此不可用"，模式仍然进得去。理由：缺的工具**可能在这一轮里被装上**；模块化的授权是操作者给的，不该被一个未装的工具一票否决。这也是 day-two 那条发现自己的措辞（"缺什么就当场说"）。
- **(b) 直接拒绝加载**：与 `filesystem: ephemeral`、`network: allowlist` 那两条"运行时兑现不了就拒加载"的先例同形。更强，但会把"没装 nmap 的机器"变成"pentest 完全不能用"。

## Acceptance Criteria

- [ ] **AC-1（R1）** 一个模式声明的机器工具在 `doctor` 里为 null 时，加载会输出一次**用户可见的声明**，**同时点名工具与受影响的能力**。
- [ ] **AC-2（R4）** 存在一个用例抓住它（对着 `doctor` 的 null 工具构造，断言那句声明出现）；反向：工具齐全时**不**出现。
- [ ] **AC-3（R2）** 既有的模式拒绝路径与它的测试**不变且仍绿**。
- [ ] **AC-4（R5）** `code-development` 加载时**零新增输出**（用例断言）。
- [ ] **AC-5（R3）** 实现对账用的是注册表里已有的 `preconditions`，**没有新字段**。
- [ ] **AC-6** 三连门禁与三道文档门不降。

## Out of Scope

- **不在机器上装** `nmap` / `hydra`（那是环境，不是产品）。
- **不改** `doctor` 的工具清单本身，也**不改**那两条已经完整的拒绝链（环境变量、文档解析）。
- **不规划** `10-03-pi-1-upgrade` 的宿主面（它是另一条线）。

## 给使用过程页的回填（做完时）

`.trellis/spec/backend/personal-agent-usage.md` 第 6 阶段与 §10 把这一条记为 "gap owned by `.trellis/tasks/10-03-mode-prerequisites`"。做完后那两行按**实际行为**改写（(a) 或 (b) 决定了措辞），并保留"停机是设计行为"的引用。

## Resolved（2026-10-05 归档）

**R6 的答案是"都不是"：机器工具根本不是前提。** 你 2026-10-05 的裁决原文：**"这些工具并不是硬性要求，只是如果去写脚本或者需要调用工具这些需要记得去调用写脚本也需要写通用性高的脚本，方便复用"**。⇒ **取消**本任务原本计划的加载期检查（既不警示也不拒加载）：不为缺席的工具拦任何东西。

**这条要求没有消失，它换了形态**：变成了**模式文件自己的规则**——需要工具就**去调用并留下回显**、写出的脚本要**通用可复用**。落在 `modes/code-development/MODE.md`（Method 第 5 条）、`modes/code-audit/MODE.md`（Method 第 7 条）、`modes/pentest/MODE.md`（`## During the run` 一条），由 `tests/mode-tool-use.test.ts` 看着（该用例已被证明会红）。

**另外两例早已完整**（day-two 读数量到：模式停摆时拒绝把原因链完整送到用户，发现数 0）⇒ 本任务**无剩余内容**，归档。

**回填已完成**：使用过程页第 6 阶段那一行从"Gap"改成"Closed as not-a-gap, by the owner's decision of 2026-10-05"，§10 的那一行**离开**（该页自己的协议：缺口关掉时两处一起改）。
