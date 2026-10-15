# OPTIMIZER_LOG — licguard

## Round 1 · 2026-10-15

### 一、存活评估

**同类替代**：`license-checker`（npm 生态最主流）、`licensed`（GitHub 官方）、`licensee`、`caniuse-lite` 之类。

**对比**：

| 维度 | licguard | license-checker / licensed |
|---|---|---|
| 依赖 | 零 | 数十到上百个传递依赖 |
| 安装 | `git clone` 即可 | 必须 `npm install` / `npm i -g` |
| 网络 | 全离线 | licensed 走 GitHub API |
| 输出 | 分类表 + JSON + 退出码门禁 | 报告 / JSON |
| 短板 | 不解析 SPDX 全集、不查 license.txt 正文 | 无 |

**结论：保留。** 它没有在能力上碾压，但在**部署成本**上碾压（零依赖 vs 必须安装）。对一个要塞进 CI 的合规门禁，「clone 下来就能跑」本身就是核心竞争力。家族门面 `family-showcase` / `track-capped` 已把它列为依赖治理层的推荐入口，删掉会留空洞。

### 二、方向选择

**单点深度特化**（不是整体转向）。

理由：这个工具的问题**不在赛道**。它的骨架和分类器本来就是对的——
`PRIORITY` 表让 SPDX 的 `OR/AND` 取最严格 token（合规应当保守，这是对的）；
`classifyToken` 里 `^lgpl` 判断排在 `gpl` 前面（LGPL-2.1绝不能被当成强传染，这是对的）。

问题全部集中在一层：**扫描基座（basis）**。旧实现把「`node_modules` 里有啥就扫啥」当作事实上的全部依赖 universe。这个假设在开发机成立（你刚install 过），在 CI 的干净 clone 里不成立。而合规工具最不能出错的地方，恰恰就是「它说没问题的时候」。

所以深挖这一层：让输出从**看起来干净**变成**真的可信**。

### 三、找到的缺陷与修复

#### P0 — 只扫 node_modules，干净 clone 时扫 0 个包却退出 0

**复现**：

```
/tmp/lg/package.json     声明 gpl-lib@^1.0.0, mystery@^2.0.0
/tmp/lg/node_modules/    只有 foo（MIT）
```

旧实现输出：

```json
{ "scanned": 1, "summary": {"permissive":1,"weak":0,"strong":0,"unknown":0},
  "packages": [{"name":"foo","version":"1.0.0"}] }
```

退出码 **0**。

`gpl-lib` 一个 GPL 包就这么人间蒸发，工具还给了个绿色通过。这是**合规门禁的教科书级假阴性**——比漏报更恶劣的是它主动给了一个「你可以放心」的信号。

**修复**：新增 `buildBasis()` 作为唯一扫描基座入口。

- `readDeclared()` 读根 `package.json` 的 `dependencies` / `devDependencies` / `optionalDependencies` / `peerDependencies`，同包多字段时保留先声明的。
- `isInstalledAt()` 按 `node_modules/<name>/package.json` 判定落地（支持 scoped）。
- `isLocalRef()` 豁免 `workspace:` / `file:` / `link:` / `portal:` / `git+` / `git:` / `http(s):` / `github:` —— 这些本来就不该从 registry 装。
- 未落地的声明依赖进 `missing`，行标记 `notInstalled: true`，类别按 `unknown` 计入汇总。
- 新增**退出码 3**：扫描基不完整时拒绝给出合规结论。`--allow-missing` 是显式逃生口（仍然展示、仍然计入 unknown，只是不再强制退3）。
- JSON 新增 `installed` / `notInstalled` / `basisComplete` 三个字段，其中 `basisComplete` 直接给 CI 当开关用。

**新语义**：`scanned` 不再等于「扫了几个包」，输出头部改为 `依赖总数 : N（已安装 X / 声明未安装 Y）`，表格里未安装的行类别列显示「未安装」而不是伪装的类别。

#### P1 — 空目录与坏 manifest 静默返回 0 个包

`findPackages` 在 `node_modules` 不存在时返回 `[]`，然后打印「依赖总数 0」退出 0。根 `package.json` 语法错误时更糟——JSON.parse 抛异常被 catch 掉，同样静默。

路径写错、CI 漏 checkout、manifest 手改坏了，三种完全不同的事故给出同一种绿色输出。

**修复**：`main()` 入口前置校验——目标必须是存在的目录；manifest 非法JSON 报错退 2；既无 manifest 又无 node_modules 报「无从扫描」退 2。`findPackages` 内部的 `readJson` 改为返回 null 并跳过，不抛。

#### P1 — README 的「CI 门禁用法」段在吹牛

原文：「在流水线中运行本工具，它会输出**健康分**与严重度」。

`licguard` 根本没有健康分这个概念——那是同家族 `doctors` / `enghealth` 的词，被模板串过来了。而且真实的 `--max` / `--fail-on` 行为、退出码含义一个字没提。

**修复**：删掉整段，替换为真实的退出码表、退出码 3 的成因与修法、`basisComplete` 字段说明，CI 示例补上 `npm ci` 前置（这是新语义下必须的一步）。

#### P2 — 声称 MIT 但无 LICENSE 文件

从 `doctors` 统一取用。

### 四、门禁可信度：变异测试

单测从 6 项扩到 14 项，冒烟从 0 个脚本扩到 26 项断言（`scripts/smoke-cli.js`，真实 spawn 子进程）。

| 变异 | 单测 | 冒烟 | 结论 |
|---|---|---|---|
| `missing` 恒为空（=还原旧行为） | fail 2 | fail 6 | 拦下 |
| 退出码 3 改回 0 | pass 14 | fail 2 | 冒烟拦下 |
| `isLocalRef` 豁免失效 | 全崩 | — | 拦下（手法不干净，见下） |

**已知盲区**：退出码 3 这类纯 CLI 行为没有单测覆盖（单测调函数，不 spawn 进程）。这次靠冒烟脚本兜住了，但这说明**家族里所有 CLI 工具都必须有 spawn 级测试**，已记入 skill。

### 五、我自己的错误

1. **变异 3 的替换写成了非法语法**。我用python 把 `return /^(workspace:|...)/.test(s)` 替换成 `return false;`，但那行后面还跟着 `|| /^(git\+|...)/.test(s)`，拼接后成了 `return false; || ...`——语法错误，整个模块 require 就炸，测试全崩。拦下结论有效，但这次只证明了「代码坏了会红」，没证明「豁免逻辑被测到了」。正确做法是改成合法但语义相反的写法（`return !/^.../.test(s)`）。

2. **写 README 时命令示例丢了空格**（`node index.js.` / `--max 0#`），靠事后grep 补救。文档里的可执行示例本身就是最容易复制出错的地方，以后写完必须逐条 `grep` 复验。

### 六、变更清单

| 文件 | 改动 |
|---|---|
| `index.js` | 新增 `readJson` / `readDeclared` / `isLocalRef` / `isInstalledAt` / `buildBasis`；入口前置校验；退出码 3；`--allow-missing`；JSON 新增三字段；帮助文本重写 |
| `test.js` | 6 → 14 项（原有 6 项一字未改） |
| `scripts/smoke-cli.js` | 新增，26 项断言 |
| `.github/workflows/verify.yml` | 新增，ubuntu + windows 双平台 |
| `README.md` | 全文重写，删吹牛段 |
| `LICENSE` | 新增 MIT |
| `GH_OPTIMIZER_STATE.json` | 新增 |
| `OPTIMIZER_LOG.md` | 本文件 |