# 交接单 —— 今晚只有一件事

> 读完 `AGENTS.md` 再读这份。今晚**只做 T1**，不要顺手做别的。

## 背景（30 秒）

子衿要从「班级成绩表」里导入数据。但每个学校的表格式都不一样，
现有做法（硬编码列名 + 正则）在真实表格上必然失败。

真实案例：某校期中表有 22 列，其中 **4 个列都叫「级名2」**，
靠列位置隐式分组；表头的 `1`/`2` 不是层级而是**考试次别**；
数学英语有 `分层` 列而语文物理没有；还多出一个派生的 `浮动` 列。

所以第一步不是写导入，是写**一个能把任意表格结构描述出来的探测器**。

## 今晚的任务：T1 · 表格结构探测器

### 做什么

在 `scripts/detect/` 下实现一个纯函数模块：

```
detect(table: Cell[][]) => StructureSketch
```

输入是一个二维数组（第一维是行），输出一份结构草图。**不读写文件、不碰 DOM、不依赖 React。**

再配一个 CLI 包装：读 xlsx → 打印 JSON。

### 输出格式（严格按这个形状）

```json
{
  "headerRows": 1,
  "columns": [
    { "index": 1, "header": "姓名", "role": "student.name", "confidence": 0.98 },
    { "index": 3, "header": "总分1", "role": "exam.total", "attempt": 1, "confidence": 0.9 },
    { "index": 11, "header": "数学分层", "role": "tier", "subject": "数学", "confidence": 0.95 }
  ],
  "subjectGroups": [
    { "subject": "数学",
      "columns": { "tier": 11, "rankPrev": 12, "score": 13, "rank": 14 } }
  ],
  "derivedColumns": [
    { "index": 7, "header": "浮动", "reason": "疑似 = 级名1 − 级名" }
  ],
  "warnings": [
    "列 10/14/18/21 表头同为「级名2」，按位置归到最近的科目前缀"
  ]
}
```

`role` 的取值限定如下，不要自创：

```
student.name | student.class | exam.total | exam.rank | subject.score
subject.rank | subject.rankPrev | tier | advisor | derived | unknown
```

### 必须处理的情况

1. **单行表头**（`sample-standard` / `sample-flat`）
2. **多行合并表头**（`sample-messy`，第 1 行是标题，第 2–3 行是表头，末行是合计）
3. **重复列名**：多个「级名2」要按位置归到左边最近的科目前缀
4. **次别后缀**：`总分1` / `分数2` 里的数字是次别，不是层级
5. **派生列**：`浮动` 这类可由其他列算出来的列，要标出来，不要当原始数据
6. **坏数据**（`sample-broken`）：姓名列表头为空、分数是文本、有重复行、有空行。
   不要崩，输出 `warnings` 后继续。

### 验收（闸门，必须全过）

```bash
npx vitest run          # 单测必须全绿
node scripts/detect/cli.mjs reference/samples/sample-standard.xlsx
```

逐条判据：

| # | 输入 | 期望 |
| --: | :-- | :-- |
| 1 | `sample-standard.xlsx` | `headerRows=1`；22 列；4 个科目组；2 个 `tier` 列（数学/英语）；1 个派生列（浮动） |
| 2 | `sample-flat.xlsx` | `headerRows=1`；3 个科目组；**没有** tier 列 |
| 3 | `sample-messy.xlsx` | `headerRows=3`；能跳过标题行和合计行 |
| 4 | `sample-broken.xlsx` | 不抛异常；`warnings` 里至少有一条指出姓名列缺失 |
| 5 | 任意输入 | 输出是合法 JSON，且 `columns` 覆盖全部列（无遗漏） |

**这五条会写进单测。** 单测绿了才算完成，不要靠"跑起来看着对"。

### 不要做

- 不做 UI、不做界面
- 不做数据库、不落库
- 不接任何在线 API
- 不动物流/包名/Capacitor 配置
- 不改 `reference/` 下的样例文件

## 参考材料（只读，白名单）

需要理解"真实表格长什么样"时，可以读这几个文件：

```
C:\Work\repos\teacher\docs\教师工作台-需求分析与方案.md
C:\Work\repos\teacher\scripts\build_seed.py
C:\Work\repos\teacher\README.md            （看 §3 数据来源、§4 测试）
```

**不要 `ls` / 不要进** 这些目录：`re/`、`shots/`、`app/dist/`。
里面是真实学生数据，与任务无关。

## 技术建议

- 读 xlsx 用 `exceljs`（不要自己解 zip）
- 类型定义写在 `types.ts`，`StructureSketch` 是公开契约，改它要先问人
- `detect()` 里不要有 `await`——这是纯同步函数，便于测试
- 置信度 `confidence` 是给你自己用的：低置信度的列会在 UI 里被高亮给老师确认

## 完成之后

在 `docs/handoff.md` 末尾追加一段「T1 完成记录」，写：

- 实际做了什么
- 五条判据的实际结果
- 你发现的、和上面描述不一致的地方（这条最有价值）
- 建议的 T2

**不要 commit 到 main 以外的地方乱放，也不要推送。**
