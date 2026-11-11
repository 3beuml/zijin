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
