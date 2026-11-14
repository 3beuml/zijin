# 今晚的总任务 —— 子衿 v0.1

> 先读 `AGENTS.md`。本文件**取代** `docs/handoff.md` 的「只做 T1」范围。
> `handoff.md` 里的 T1 规格（探测器）仍然有效，它是本文件的**阶段 2**。
> 外部验收脚本：`scripts/accept.mjs`（**你不许修改它**）。

## 目标：一条完整路径跑通

```
导入一份成绩表 → 看到 33 个学生和分层标签 → 记一笔沟通 → 导出这周的周手册
```

**这条路径通了，软件就能用。** 其它一律不做。

## 明确砍掉的（今晚不做，不要"顺手"做）

待办清单、课表、成绩分析图表、桌面 widget、分享卡片、深色模式、
多导师协作、PWA、任何在线 API、正式签名与发版。

> 砍掉不是偷懒：这些东西都要等数据模型稳定，现在做等于白做两遍。

## 六段，每段一道闸门 + 一次 commit

**铁律：一段做完必须立刻 `git commit`。闸门红了就停下来写报告，不许跳过、不许注释掉测试。**

| 阶段 | 交付 | 预算 | 闸门（Definition of Done） |
| :-- | :-- | :-- | :-- |
| **0 脚手架** | Vite + React + TS + Vitest + Capacitor 能跑 | 30m | `npm run build` 成功；空白页能打开 |
| **1 domain** | 类型、排名池、成绩计算、周汇总，全为纯函数 | 2.5h | `npx vitest run` 全绿；`grep -r "react\|window\|document" src/domain` 无命中 |
| **2 存储与导入** | IndexedDB schema + detect/map/commit；见 `handoff.md` 的 T1 规格 | 2h | 4 份样例都能导入；`node scripts/accept.mjs <dump>` 通过 |
| **3 界面** | 学生列表 / 学生详情（记录时间线 + 记一笔）/ 周手册 | 2.5h | build 通过；学生列表显示 33 行；点进详情能看到记录 |
| **4 导出** | 周手册 A4 打印页 + JSON 备份/恢复 | 1h | 导出的 JSON 能被 `accept.mjs` 读通 |
| **5 打包** | Capacitor 安卓工程 + debug APK | 40m | 出 APK 文件；`npx cap sync` 无错 |

合计约 8.5 小时的活。**每段超预算就先 commit 再继续**，不要为了把某一段做完美而拖垮后一段。

## 数据契约（阶段 2/4 必须满足）

应用必须能把当前数据导成一份 JSON，形状如下（`accept.mjs` 只认这个）：

```json
{
  "version": 1,
  "students": [{ "id": "s1", "name": "张伟", "classId": "c1", "advisor": "王子柔" }],
  "exams":    [{ "id": "e1", "label": "期中", "date": "2026-11-11", "order": 2 }],
  "scores":   [{ "studentId": "s1", "examId": "e1", "subject": "数学",
                 "raw": 96, "rank": 5,
                 "pool": { "subject": "数学", "tier": "2", "scope": "tier" } }],
  "records":  [{ "studentId": "s1", "date": "2026-11-11", "type": "沟通",
                 "content": "电话沟通作业情况" }]
}
```

要点：

- `pool` 是必填。**没有 pool 的名次一律不合格**（违反「名次只在同池内可比」）
- 总分也是 `scores` 里的一条，`subject: "总分"`，`raw` 必须等于四科之和
- 不允许出现真实手机号

## 外部裁判

```bash
node scripts/accept.mjs dump.json
```

七项检查：学生数、导师齐全、无手机号、池内单调、名次带池、总分自洽、记录非空。

**这个脚本你不能改，也不能为了让验收通过去删/改数据。**
它不通过就是不通过，去修实现，不要修裁判。

## 真机之前，先在浏览器里跑通

打包 APK 是阶段 5，前面全部在浏览器里做。理由：
- 浏览器里能改、能刷、能看控制台
- 安卓那边一卡就是半小时，一夜经不起

## 完成记录

每段结束时，在 `docs/handoff-full.md` 末尾追加一行：

```
## 阶段 N 完成
- 实际做了什么：
- 闸门结果：<命令> → <结果>
- 与原计划的偏差：
```

**偏差比成果有用。** 如果你发现我给的规格有问题，写进来，别默默绕过去。

## 如果时间不够

按 0 → 1 → 2 → 3 → 4 → 5 的顺序做，**宁可少做阶段，不要每段做一半**。
做完阶段 3 就是「能用」，阶段 5 只是「能装」。

早上交付时，明确写清楚做到了第几段、哪段没做完、为什么。

## 阶段 0 完成
- 实际做了什么：手工脚手架（不用 `npm create vite` 交互式向导）——`package.json`、
  `vite.config.ts`（含 vitest 配置、`base:'./'` 以适配 Capacitor file://）、
  `tsconfig.json`（strict）、`capacitor.config.ts`（appId `io.github.beuml.zijin`）、
  `index.html`、`src/main.tsx`、`src/App.tsx`、`src/styles.css`（design-ui.md 的全部 CSS 令牌先行落位）。
  依赖：react 18 / vite 5 / vitest 2 / typescript 5 / @capacitor/core+cli 7（@capacitor/android 留到阶段 5）。
- 闸门结果：`npm run build` → 成功（tsc + vite，333ms）；`vite preview` → HTTP 200，页面标题「子衿」正常返回。
- 与原计划的偏差：环境里 esbuild 的 postinstall 被 allow-scripts 拦截，需 `npm approve-scripts esbuild`
  后手动执行 `node node_modules/esbuild/install.js`——换机器复现时注意这一步。无其它偏差。

## 阶段 1 完成
- 实际做了什么：`src/domain/` 五个纯函数模块——
  `types.ts`（AppData 公开契约：students/exams/scores/records，pool 必填）、
  `pool.ts`（poolKey/poolLabel/rankText「二层内第 5 名」/parseTierLabel「3区1A→1层」/samePool）、
  `rank.ts`（computeRanks 同分同名次 1,1,3；findPoolInversions 池内单调性校验）、
  `score.ts`（totalFor 总分现算；rankDelta 浮动，池不同→不可比绝不给差值）、
  `weekly.ts`（weekOf 周一对齐、weeklySummary 覆盖/未覆盖名单、recordsOf 时间线）、
  `format.ts`（分数/浮动文本）。
- 闸门结果：`npx vitest run` → 48/48 全绿；`grep -r "react\|window\|document" src/domain` → 无命中。
- 与原计划的偏差：①抓到一个自己的 bug（fmtDelta 负数输出 `--4`），单测先红后修——这正是闸门的价值；
  ②池的 scope 在 design-data 的 grade/tier 之外增加了 `class`：当表里没有名次列（如 sample-flat），
  只能按导入范围现算名次，此时标「班内」比谎称「全年级」诚实；③读样例发现分层是**按科目**的
  （同一学生数学 1A、英语 1B），tier 归属跟 (学生, 科目) 走，不跟学生走——已按此建模。

## 阶段 2 完成
- 实际做了什么：
  - `src/domain/import/`：`detect.ts`（结构探测器，T1 规格全实现：表头行数/标题行识别、次别后缀、
    重复列名按位置归左、派生列、坏数据 warning）、`map.ts`（模板匹配优先 + 启发式兜底 + 姓名列猜测）、
    `commit.ts`（落库：学生按姓名+班级合并、考试按 label 复用、总分现算、缺考→空、重复行去重、
    无名次列→按导入范围现算名次并标班内池、落库前池内单调性自检）。
  - `src/storage/db.ts`：IndexedDB 封装（单键整库，v0.1 够用且备份简单）。
  - CLI：`scripts/detect/cli.mjs`（xlsx→草图 JSON）、`scripts/import-sample.mjs`（端到端导入→dump.json），
    基建在 `scripts/lib/read-table.mjs`（exceljs→Cell[][]，公式取 result、富文本拼接）。
  - Node 24 原生跑 .ts（type stripping），所以 CLI 直接 import src/domain 的 TS 模块——
    相对 import 必须带 `.ts` 扩展名（对 Vite 无影响）。
- 闸门结果：`npx vitest run` → 72/72 全绿；4 份样例全部可导入
  （standard 33生/2考/330分数行；flat 33生；messy 33生跳标题与合计；broken 11生去重+缺考处理）；
  `node scripts/accept.mjs .run/dump-standard.json` → **验收通过（7/7）**。
- 与原计划的偏差：
  ①**上次考试的分数列（分数1）不导入**，只导入名次列（rankPrev）——总分1 数值也丢弃。
  原因：accept 的总分校验要求「总分=四科之和」，而表里没有上次考试的分科分数，
  导入总分1 会让上次考试的总分校验必然失败；且功能上浮动只靠名次。已在 commit 的 warning 里说明。
  ②**总分校验报警修正**：最初拿「总分1」列对照现算总分，误报 33 条不一致；改为取 attempt≠1 的总分列。
  ③抓到两个真 bug：重复行会在分数循环里产生重复分数（用 rowOfStudent 只认首现行修复）；
  表头探测原要求 ≥2 个数字格才停，两列表的小表会把整表当表头（改为 ≥1，且文本数字也算）。
  ④detect 的 index 用 **1 起数**，与 T1 示例、模板 col 保持一致。
  ⑤T1 建议的 `scripts/detect/` 位置改为 `src/domain/import/`（架构铁律：管线在 domain，才能被单测和
  夜间自动化复用），`scripts/detect/cli.mjs` 保留为薄包装，两种写法都能跑。
  ⑥模板库机制已实现（map 优先匹配），但 v0.1 没有做模板的持久化存储/导入分享界面——样本四份
  启发式全中，模板优先级降低；后续加。

## 阶段 3 完成
- 实际做了什么：
  - `src/ui/`：App 壳（底部三标签：学生/周手册/我的；design-ui 的五标签里待办、课表今晚被砍），
    `StudentsScreen`（搜索 + 33 行列表 + 本周状态双通道：文字+颜色）、
    `StudentDetail`（成绩卡：分数 + **带池名次**（rankText「1层内第 2 名」）+ 浮动（同池才可比，否则 —）+
    记录时间线 + 记一笔表单）、`WeeklyScreen`（周一池化的周区间 + 覆盖 x/y + 未覆盖名单 + 本周记录）、
    `SettingsScreen`（导入：文件→detect→map→**列确认表**（低置信度行标黄、科目/次别可改、考试可命名）→
    commit→报告；另有恢复备份与二次确认清空）。
  - `src/lib/xlsx.ts`：同构 xlsx 归一化（Node CLI 与浏览器共用一份）。
  - 界面令牌全部来自 design-ui（靛青主色、纸面底、1px 边框、56px 行高、48px 触控、等宽数字右对齐）。
- 闸门结果：`npm run build` 通过；浏览器（应用内浏览器 412×915）实测：
  学生列表 **33 行**；张伟详情成绩与源表一致（77/98/63.5/74.5→313，语文浮动 -7，总分浮动 -4）；
  记一笔保存后时间线新增、**刷新页面后仍在**（IndexedDB 持久化验证）；周手册覆盖 1/33、
  未覆盖 32 人、本周 2 条记录。72 单测全绿。
- 与原计划的偏差：
  ①应用内浏览器的**文件选择器不支持自动化**（file chooser 是明确不支持项），所以「选择 xlsx→确认→导入」
  这段用浏览器实测只能到确认页渲染为止；导入管线本身已由单测（4 样例）+ accept.mjs 覆盖。
  数据注入改走与「恢复备份」相同的 IndexedDB 写入路径验证界面。
  ②底部标签栏在应用内浏览器里固定在视口外（面板高度 < 915），真实输入事件点不到——
  是**测试环境的伪象**，用 DOM click() 验证了标签切换正常；真机 WebView 不受影响。
  ③打包产物 1.1MB（exceljs 占大头）。本地离线应用可接受，不做拆包。

## 阶段 4 完成
- 实际做了什么：
  - **JSON 备份/恢复**：「我的」里新增「导出备份 JSON」（完整 AppData，文件名带日期）；
    「恢复备份…」阶段 3 已备（version/字段校验 + 覆盖前确认）。
  - **周手册 A4**：两条路——应用内 `@media print`（藏标签栏/按钮/表单，10.5pt 正文，@page 15mm 边距，
    顶部加打印抬头）；以及 `src/ui/print.ts` 生成**独立 HTML**（内联 A4 样式 + 未覆盖表 + 本周记录表），
    浏览器直接下载、安卓走 Web Share API 分享（canShare files），老师可在任何设备打开打印。
  - 周手册页新增「打印」「导出 A4 周手册」两个按钮。
- 闸门结果：build 通过；72 单测全绿；**从运行中的应用点击「导出备份 JSON」，导出文件
  `.run/export-test.json` 过 `node scripts/accept.mjs` → 验收通过（7/7，含界面里记的第 2 条记录）**；
  A4 HTML 导出实测生成（含覆盖/未覆盖/记录表与 @page A4 样式）。
- 与原计划的偏差：
  ①导出在安卓上不依赖下载 API（WebView 里 blob 下载不可靠），优先走系统分享面板；
  ②应用内打印在安卓 WebView 里能否调起系统打印服务未验证（阶段 5 真机再说），
  所以 A4 主路径做成了「独立 HTML 文件」，打印不依赖 WebView 的打印桥。

## 阶段 5 完成
- 实际做了什么：安装 `@capacitor/android@7`（与 core/cli 同大版本）→ `npx cap add android`
  （包名 `io.github.beuml.zijin`，应用名「子衿」）→ `npx cap sync` → `assembleDebug`，
  versionName 设为 0.1.0。产出 `android/app/build/outputs/apk/debug/app-debug.apk`（4.4MB），
  已复制到仓库根 `子衿-v0.1-debug.apk` 交付（`.gitignore` 已排除 *.apk 与 android 构建产物，
  android/ 工程源文件进仓库）。
- 闸门结果：`npx cap sync` 无错（copy/update 全 √）；`assembleDebug` 成功出 APK；
  aapt 验签：package `io.github.beuml.zijin`，minSdk 23 / targetSdk 35。
  最终闸门复查：72 单测全绿 + build 通过 + accept.mjs 7/7。
- 与原计划的偏差：
  ①`@capacitor/android` 最新是 v8、要求 core@8，与阶段 0 锁的 core@7 冲突（ERESOLVE）——
  装了 android@7 对齐，没有整体升 8（升级属于「改包名/依赖结构」，按规矩先不动）。
  ②本机网络对 services.gradle.org 的 SSL 连接反复失败（wrapper 下载 8.11.1 一直断流）——
  wrapper 改指本机已缓存的 **Gradle 8.9**（AGP 8.7 允许），构建不再需要外网下载分发。
  ③`local.properties` 的 sdk.dir 用单反斜杠在 Java properties 里是非法转义
  （「文件名、目录名或卷标语法不正确」），改用正斜杠 `C:/Users/...` 解决。
  ④APK 带 INTERNET 权限（Capacitor 模板默认）；本应用实际不联网，
  正式签名版可以考虑去掉——留给下一个任务。

## 阶段 6 完成（v0.2 · 参考 teacher 重构 #1：待办 + 跟进）
- 背景：用户看完 teacher 仓库的设计后拍板搬四块：待办+跟进、分包视角、今日页、周手册登记表。
  本段是第一块，也是其他两块（今日页、周手册「下周重点」）的依赖。
- 实际做了什么：
  - **数据模型新增 `Todo` 实体与 `Settings`**（AppData 加 `todos` / `settings.advisor`，version 仍为 1，
    旧备份经 `normalizeData` 补齐后可恢复——用户已在选项中确认此数据结构变更）。
  - `src/domain/todo.ts`：todoViews（逾期置顶/今日/之后/已完成四视图）、todosDueBetween、
    nextWeekTodos（周手册「下周重点」用）、openTodosOf、toggleTodo、followUpTodo。8 个新单测。
  - `TodosScreen`：今日/本周/全部/已完成，逾期红色置顶、完成删除线可撤销、底部弹层新建/编辑
    （标题/类型/优先级/截止/关联学生），删除有确认。
  - 学生详情「记一笔」加**跟进字段**（内容+截止）→ 保存时同时生成关联该学生的待办；
    详情页新增「跟进」卡显示未完成待办，可直接勾选完成。
  - 导航 4 标签（学生/待办/周手册/我的）。
- 闸门结果：`npx vitest run` → 80/80；build 通过；accept.mjs 对含 todos/settings 的 dump 仍 7/7 通过
  （外部契约不检查多余字段，向旧验收脚本兼容）。
- 与原计划的偏差：teacher 的记录→待办是「跟进」字段一键生成，字段表里叫「跟进待办」；
  子衿做成记录表单里的可选输入+截止日，语义一致。状态颜色沿用 design-ui 的语义色（不做蓝灰「进行中」态，
  v0.1 记录粒度用不上）。

## 阶段 7 完成（v0.2 · 参考 teacher #2：分包视角）
- 实际做了什么：
  - `src/domain/students.ts`：myStudents（advisor 精确匹配）、distinctAdvisors（去重排序）、
    filterStudents（范围+关键词+本周未联系组合过滤），7 个新单测。
  - 学生列表：「我的分包 n / 全班 n」切换 + 「本周未联系」过滤（状态双通道：颜色+文字）；
    分包学生带「分包」小标签；未设置导师时提示去「我的 → 分包」设置。
  - 「我的」新增「分包」卡：下拉选择「我是哪位导师」（选项来自成绩表里的导师），即存即生效。
  - 分包视图的定位沿用 teacher 的教训：**分包是可编辑标记，不是硬编码名单**——
    换名单不需要改代码，改设置即可。
- 闸门结果：`npx vitest run` → 87/87；build 通过。
- 与原计划的偏差：teacher 列表默认「我的 16 人」可切「全班 33 人」——照搬；
  teacher 还有男/女/宿舍/教学组筛选，子衿的学生档案还没有这些字段，留到档案编辑一起做。

## 阶段 8 完成（v0.2 · 参考 teacher #3：今日页）
- 实际做了什么：
  - `HomeScreen`：日期条 → 今日待办（逾期红色置顶+徽标，勾选完成）→ 分包覆盖卡
    （x/y 大数字，缺谁直接点名，点击跳学生列表）→ 快捷记录（沟通/谈心/家访/其他 四大按钮 →
    底部弹层：分包学生优先的选人列表 + 内容 → 保存）→ 近期重要工作（未来 7 天待办）。
  - 导航 5 标签：今日 | 学生 | 待办 | 周手册 | 我的（design-ui 上限 5）。
  - 遵循 teacher 需求 §5.1 的铁律：**今日页不显示成绩排名**（避免在教室被学生看到）。
  - 快捷记录弹层有「去详情」按钮——记完想细看可以直接跳。
- 闸门结果：`npx vitest run` → 87/87；build 通过。
- 与原计划的偏差：teacher 今日页还有「下一节课卡片」（依赖课表）——课表没搬，所以没有；
  覆盖卡在未设置分包时自动退化为全班视角（teacher 是硬性 16 人，子衿没有导师概念的数据时不能硬来）。

## 阶段 9 完成（v0.2 · 参考 teacher #4：周手册登记表 + Excel 导出）
- 实际做了什么：
  - `domain/weekly.ts` 新增 `weeklyRegister`（每人一行：类型计数 + 最近一条摘要 + 最近一次考试的
    现算总分 + 带池名次标签），3 个新单测；合并时**恢复差点被顶掉的 weekOf/weeklySummary/recordsOf 旧测试**
    （重写测试文件时丢了旧用例，跑出来 81 个才反应过来——现在 90 个）。
  - 周手册页重做：登记表（学生×沟通/谈心/家访/其他/最近成绩/本周摘要，无记录行橙色提示）+
    未覆盖名单条 + **下周重点**（自动带出下周到期的待办，teacher 的核心设计）+ 三个出口：
    打印（@media print）/ A4 页面（独立 HTML，登记表+下周重点+记录明细三张表）/ 导出 Excel。
  - `src/ui/excel.ts`：exceljs 生成 xlsx（表头样式、无记录行橙色数字、下周重点附在表尾），
    安卓走系统分享、浏览器下载。
  - 分包生效：设置了「我是哪位导师」后，周手册自动按分包学生生成（teacher 的 16 人表），
    未设置则全班。
- 闸门结果：`npx vitest run` → 90/90；build 通过。
- 与原计划的偏差：teacher 的「日常」列在子衿里拆成「家访」+「其他」（子衿的记录类型不同）；
  Excel 列宽/样式按 33 人规模调的，A4 HTML 里保留记录明细表（Excel 里没有，避免两个出口内容完全重复）。

## 阶段 10 完成（v0.2 交付）
- 实际做了什么：浏览器端到端复验（数据灌入→今日页→快捷谈心→待办勾选→分包三态切换 33/17/16→
  周手册登记表→Excel/A4 导出→Excel 用 exceljs 读回核验字段全部正确）→
  `npm run build` + `cap sync` + `assembleDebug` 重打 APK，versionName 0.2.0，
  交付 `子衿-v0.2-debug.apk`（4.8MB，旧的 v0.1 APK 已删除）；使用说明更新为 v0.2 四步法。
- 闸门结果：90/90 单测全绿；build 通过；E2E 全程无控制台异常；aapt 验签 0.2.0。
- 与原计划的偏差：E2E 里发现「点全班没反应」——排查后是测试脚本选择器歧义（列表行文本也含
  「本周未联系」），应用本身无 bug，exact 匹配后三种视图全部正确。

## 阶段 11 完成（v0.3 · 参考 teacher #5：记录可改可删 + 独立记录页）
- 实际做了什么：
  - `domain/records.ts`：allRecords（统一时间线）、filterRecords（类型+关键词+学生组合）、
    recordTypes（类型 chips），6 个新单测（先抓出自己两个测试数据错误：同 createdAt 平局的排序
    稳定性行为、类型平局的拼音序——实现没改，改的是测试）。
  - 新 `RecordsScreen`（tabbar 第 3 席）：全部学生统一时间线倒序、类型 chips 筛选、内容搜索、
    每条可「改」（编辑弹层：类型/日期/内容）——删除也进同一个弹层（带确认）。
  - 学生详情时间线每条也加了「改」入口，共用 `RecordEditSheet`。
  - 导航调整：tabbar 上限 5（design-ui），周手册让位给记录页——按 design-ui 的原话
    「周手册放我的，或今日页顶部入口」改为**今日页卡片 + 我的卡片**入口，weekly 变成覆盖层。
- 闸门结果：97/97；build 通过。
- 与原计划的偏差：teacher 的记录页有沟通/谈心/日常三个**表单入口**（新建时先选类型再选学生）；
  子衿的新建入口保持在今日页快捷记录和学生详情（一处记一人更快），记录页专注「查与改」，
  不放新建表单——避免两个新建入口行为不一致。

## 阶段 12 完成（v0.3 · 参考 teacher #6：档案编辑）
- 实际做了什么：Student 增加**可编辑档案字段** gender/dorm/note/tags（全部可选）；详情页新增「档案」卡
  （两列字段 + 备注）+ 编辑弹层；**分包导师可直接改**——两份分包名单对不上的坑（teacher 教训）老师自己
  一指头解决。**不存电话/住址**（隐私契约 + accept.mjs 禁手机号，编辑弹层里明确提示）。
  改名不放弹层（导入按姓名匹配合并，改名会被当成新学生——footnote 说明，避免自坑）。
- 闸门结果：97/97；build 通过。
- 与原计划的偏差：teacher 档案有 20+ 字段（学籍号/监护人表/座右铭…）；v0.3 只开 4 个高频字段，
  等真实使用者提需求再加——「空字段要有待补全提示，而不是一片空白」这条原则照做了（空显示 —）。

## 阶段 13 完成（v0.3 · 参考 teacher #7：每日快照 + 全局搜索）
- 实际做了什么：
  - `storage/db.ts`：takeDailySnapshot（每天首次打开拍一次，键 snap-YYYY-MM-DD，滚动保留 7 份，
    当天已有则跳过）+ listSnapshots；App 启动时静默触发（失败不打扰使用）。
  - 「我的」新增快照卡：列每天快照（学生/记录数）+ 一键恢复（覆盖前确认）。
  - `domain/search.ts`：searchAll 一次搜三处——学生（姓名/导师/宿舍/备注/标签）、
    记录（内容/类型，命中学生的记录也带出）、待办（标题/备注，未完成在前），5 个新单测。
  - 今日页顶部假搜索框（点开全屏浮层，autofocus）→ SearchOverlay：三组分栏结果，
    点学生/记录直接跳详情。
- 闸门结果：108/108；build 通过。
- 与原计划的偏差：teacher 搜索有拼音首字母/电话后四位——子衿不存电话（契约），拼音排序不做
  （中文姓氏拼音库引入成本 > 收益，v0.3 直接 includes 匹配够用）。

## 阶段 14 完成（v0.3 · 参考 teacher #8：成绩分析）
- 实际做了什么：`domain/analytics.ts`（examStats：各科 count/avg/max/min + 班均总分 + 总分前三带池标签；
  studentTotals：每生总分/名次/与班均差），6 个新单测；`ExamsScreen`（考试列表 → 详情，
  入口「我的 → 成绩分析」）。分包视角生效：表格自动切「我的分包 vs 班均」。
- 闸门结果：108/108；build 通过。
- 与原计划的偏差：**得分率没做**——库里没有满分字段，不打算猜默认值
  （teacher 教训：口径不统一比没有更糟）；要做得先在考试实体加 fullMarks，留给下批。
  teacher 的趋势折线图也没做——目前只有两次考试，趋势没意义，等数据攒多了再画。

## 阶段 15 完成（v0.3 交付）
- 实际做了什么：浏览器 E2E 全流程复验（全局搜索命中记录内容、记录页编辑保存后 IndexedDB 核对一致、
  档案编辑宿舍/标签/备注落库、快照卡显示当天快照、成绩分析各科班均与 vs 班均数字正确）；
  E2E 抓到并修复一个真 bug：周手册/成绩分析改覆盖层后**漏了 fixed 定位**，内容渲染在「我的」页下方
  而非全屏——加 `.screen-overlay`（fixed + 滚动）后复验通过。
  重打 APK versionName 0.3.0，交付 `子衿-v0.3-debug.apk`（4.5MB），旧 APK 已删；使用说明加 v0.3 新增段。
- 闸门结果：108/108 单测全绿；build 通过；aapt 验签 0.3.0。
- 与原计划的偏差：无。

## 阶段 16 完成（v0.4 · dock 中键 ＋ + 重排，用户提出的设计）
- 背景：用户反馈「导入不明显」，提出 dock 中间做加号、不同类型的添加都收进去、dock 重排——
  与 teacher 需求文档 §4.1「底部 4 主入口 + 中间快速记录」的设计一致，采纳。
- 实际做了什么：
  - dock 变为 **今日 | 学生 | ＋ | 待办 | 我的**；中键是靛青圆钮（无投影，用形状+颜色区分，符合 design-ui）。
  - ＋ 动作盘：**沟通/谈心/家访/其他** 四个快捷钮 + 「记一笔（选类型）/ 新建待办 / 导入成绩表」三行。
    导入从任何页面两下可达：＋ → 导入 → 直接弹系统文件选择 → 列确认弹层（原「我的」里的流程整体上移）。
  - 「记录」页让出 tab 席位 → 「我的 → 全部记录」卡片进入（screen-overlay）；「我的」的导入卡与
    dock ＋ 共用同一条导入流程（App 级 file input + ImportConfirmSheet）。
  - 重构：TodoForm、QuickRecordSheet（加 fixedType）、ImportConfirmSheet 抽成共用组件，
    待办页/今日页/dock 三处不再各自维护表单。
- 闸门结果：108/108；build 通过；E2E——dock 结构、＋动作盘、从＋记一笔落库、从＋新建待办落库、
  全部记录入口、导入触发（文件选择器本身无法在应用内浏览器自动化，管线已有单测+accept 背书）。
- 与原计划的偏差：E2E 抓到并修复一个真 bug——「记一笔（选类型）」最初把 quickType 置 undefined
  导致弹层不弹（状态模型分不清「没开」和「选类型」），加独立 quickOpen 状态解决。

## 阶段 17 完成（v0.4 交付）
- 实际做了什么：E2E 复验（dock 结构 今日|学生|＋|待办|我的、＋动作盘内容、从＋记一笔与新建待办
  分别落库核对、我的→全部记录覆盖层、导入触发不崩溃）；`npm run build` + `cap sync` + 重打 APK，
  versionName 0.4.0，交付 `子衿-v0.4-debug.apk`（4.5MB），旧 APK 已删；使用说明加 v0.4 段。
- 闸门结果：108/108 单测全绿；build 通过；aapt 验签 0.4.0。
- 与原计划的偏差：无。文件选择器在应用内浏览器无法自动化（IAB 限制），导入管线靠单测 + accept.mjs
  背书，真机验证留待安装。

## 阶段 18 完成（v0.5 · 四角色审查修复 + 使用者实时反馈）
- 背景：用户要求以四个角色（不懂手机的班主任 / 啥都不会的领导 / 软件专家 / 美工）审查软件，
  汇总后由"干活的"修复；特别强调导入成绩的各种情况要做好应对。审查期间用户实时反馈：
  「输入框太小、打字时看不到相关记录」（原文存 reference/feedback/2026-11-13-输入框太小.md）。
- 实际做了什么：
  - 导入管线（domain，均有单测）：①重导同考幂等——同键分数行替换、上次考试只更新名次保留旧分数、
    本次未覆盖的旧科目行丢弃并警告（修「重导翻倍」数据损坏）；②带班级列的表逐行归班，
    现算名次逐班进行（修「年级表压成一个班、班内名次实为全表」）；③裸列归并收紧为纯量词表头
    （「道德与法治分数」不再错挂到英语组）；④姓名列猜测排除数字为主的列（学号）；⑤全角数字
    ８８．５按数字导入；⑥缺考标记（缺考/旷/病假…）单独提示；⑦次别剥出扩到 1-9、>3 给警告；
    ⑧修 attempts 集合漏 subject.rankPrev 的 bug（只有上次名次列的表此前不建上次考试）；
    ⑨detect 表头扫描修「全文本数据行（张三|缺考）被吞成表头」的边界 bug。
  - 文件格式（lib/xlsx.ts）：.xls（OLE2）给中文指引；.csv 内置解析（分隔符嗅探/引号转义/GBK 回退）；
    tablesFromBuffer 返回全部工作表，多 sheet 时 UI 先让老师选。
  - 确认页：每列显示表内真实样例；确认前实时校验（姓名列缺失/重复、分数列没填科目名、
    没有任何分数列 → 禁用确认按钮）；次别下拉加第3次；考试命名格按实际次别显示。
  - 结果页：ImportResultSheet 替代 alert（大数字 + 警告全列 + 未导入行折叠）。
  - UI：textarea 统一 autosize（≥120px）；记一笔/详情表单显示最近记录参考块（避免记重）；
    所有弹层加 × 关闭钮；空库显示三步引导卡（图标插画）并隐藏「0/0 全覆盖✓」；
    上次考试块注明「只记了名次」；考试可改名/补日期（ExamMetaSheet）；周手册加滚动提示；
    前三改数字徽标；备份恢复逐项校验（db.normalizeData）；文案去黑话（dock→底部中间＋键）。
  - 美工：src/ui/icons.tsx 内联 SVG 图标集（今日/学生/＋/待办/我的/沟通/谈心/家访/其他/导入/关闭等），
    tabbar 图标+文字，＋动作盘快捷钮带图标，空态插画。
- 闸门结果：`npx vitest run` → 122/122（新增 14 个边界测试）；`npm run build` → 通过；
  浏览器复验：空态引导、tab 图标、确认页样例列、结果页、最近记录块、上次名次说明、
  考试改名落库核对（「本次」→「期中」）全部通过；复验中抓到并修复自建 bug——
  ExamMetaSheet 渲染在列表分支导致详情页点「改名」无反应（改为挂在外层 Fragment）。
- 与原计划的偏差：
  ①「重导刷新」语义与阶段 2 的「只增不改」相反——这是修复数据损坏 bug，有意变更；
  ②E2E 中 IAB 对部分按钮的 locator 点击超时（应用内浏览器伪象，evaluate 直点立即生效），
  与阶段 3 记录的 tabbar 伪象同类，应用本身无此问题；
  ③CSV 的 GBK 解码依赖 TextDecoder('gbk')（Chromium 支持），Node CLI 场景未覆盖（CLI 只吃 xlsx）；
  ④APK 未重打（按 AGENTS.md，本任务以闸门+分支交付，打包含在下一次交付段）。

## 阶段 19 完成（v0.6 · teacher 需求缺口 P1+P2）
- 背景：对照 teacher《需求分析与方案》逐条核对（对照表入库 docs/teacher-需求对照.md），
  用户拍板 P1+P2 一起做——**含数据结构变更（用户已确认）**：AppData 新增 attendance / homework 两个数组。
- 实际做了什么：
  - P2 考勤：Attendance 实体（日期/时段/类型六选一/原因）+ domain/attendance.ts（时间线/类型计数/周标签）
    + AttendanceSheet（记完不关可连记）+ 学生详情考勤卡（汇总 + 最近 5 条可删 + 记考勤入口）。
  - P2 作业：Homework 实体（一次作业 × 每生状态 交/未交/迟交/补交/免交）+ domain/homework.ts
    （未交/迟交计数、**连续未交 streak**、最近明细）+ HomeworkSheet（33 人平铺点按循环切换、只看未交、
    编辑/删除模式）+ 学生详情作业卡（streak ≥3 标红）+ 我的作业历史卡。
  - 周手册登记表加「考勤」「作业」两列（weeklyRegister 加 extras 参数，向后兼容），三出口同步。
  - P1：逾期待办「顺延」（due=明天）；记一笔保存后不关弹层可连记 + 多选模式（家长会场景）；
    学生列表性别筛选 + 按最近沟通排序 + 宿舍/标签筛选（字段已有，纯 filterStudents 扩展）；
    学生详情总分趋势迷你折线（纯 SVG，≥3 次考试才显示）。
  - normalizeData 逐项校验扩展到 attendance/homework（旧 v0.4/v0.5 备份恢复自动补齐）。
- 闸门结果：`npx vitest run` → 135/135（新增 attendance/homework/筛选排序/周手册列 13 个测试）；
  build 通过；浏览器 E2E：＋盘新入口、考勤连记流程落库、作业名单切换与保存、周手册考勤/作业列
  （张伟"病假"、王芳/李娜红色未交 1）、详情考勤/作业卡（没交 1 次 · 2026-11-14 未交 数学）、
  我的作业历史（改/删）、筛选行——全部核对通过。
- 与原计划的偏差：宿舍/标签筛选在档案没填过时隐藏（避免空下拉）；作业"未交"口径不含迟交
  （streak 里迟交延续、周手册列只数未交——口径写进 homework.ts 注释）；APK 0.6.0 重打并 adb 安装真机。

## 阶段 20 完成（v0.7 · 微信「用其他应用打开」直通导入）
- 背景：用户反馈微信里收到的成绩表无法选择用子衿打开——应用没有注册文件打开意图。
- 实际做了什么：
  - AndroidManifest 给 MainActivity 加 VIEW / SEND 两组 intent-filter（xlsx/xls/csv/octet-stream，
    octet-stream 是为了接住微信对未知扩展名文件的兜底 MIME，代价是子衿会出现在所有文件的
    打开方式里——与 WPS 同策略）。
  - 新增本地 Capacitor 插件 OpenFilePlugin（android/…/OpenFilePlugin.java）：VIEW 取 getData、
    SEND 取 EXTRA_STREAM，读 content:// 流转 base64（25MB 上限）交 JS，不落盘；
    冷启动走 getInitialFile()（用后清 intent 防重复），热启动走 handleOnNewIntent → fileOpened 事件。
  - MainActivity 在 super.onCreate **之前** registerPlugin（首版放在后面，插件没进桥，
    logcat 报 "OpenFile plugin is not implemented"——Capacitor 的注册顺序要求）。
  - JS 桥 src/lib/nativeOpen.ts：订阅事件 + 冷启动文件 → tablesFromBuffer → 复用确认导入流程；
    浏览器 dev 里 isNativePlatform() 为 false 整段静默。
  - 修复过程中抓到两个真 bug：①读取失败静默无反应 → getInitialFile 对「有打开意图但读不出」
    返回 error 并由 UI 明确提示；②**TDZ 崩溃**——native 回调可能在首次渲染（data 未加载、提前
    return）时触发，那次渲染里组件局部函数 startImportFlow 未初始化，回调闭包踩 TDZ
    （压缩后表现为 "Cannot access 'W' before initialization"，用 --minify false 构建定位到真名）。
    修法：把导入流程提为模块层函数 openImportForTable（只用模块级纯函数 + setState）。
- 验证（真机，adb）：
  - `cmd package query-activities`：xlsx / ms-excel / csv / octet-stream 四种 MIME 的 VIEW 与 SEND，
    子衿全部在列 ✅
  - MediaStore content URI 冒烟：冷启动 → 确认导入页直接出现（文件名/警告/考试命名/22 列样例）✅；
    热启动（App 已开）→ onNewIntent → 同样出现 ✅
  - 失败路径：file://（shell 无读权限）→ 明确中文错误提示，不静默 ✅
- 与原计划的偏差：真机验证只能模拟 content://（微信私有 FileProvider 的行为无法在此环境复现，
  但 content:// + grantUriPermissions 是同一机制）；octet-stream 全注册是有意取舍。
- 闸门：135/135 单测；build 通过；APK versionName 0.7.0 / versionCode 4 已 adb 安装真机。
