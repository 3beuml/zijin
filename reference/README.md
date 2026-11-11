# reference/ —— 参考资料与测试素材

本目录存放**可以公开**的参考资料。**任何真实学生数据不得进入本仓库。**

---

## 一、从 `teacher` 可以搬的

> `teacher` 没有 git 历史，所以是**复制内容**，不是搬仓库。

| 源 | 目标 | 价值 | 搬过来要做的改造 |
| :-- | :-- | :-- | :-- |
| `docs/教师工作台-需求分析与方案.md`（39KB） | `docs/` | ⭐ 最高。完整需求推演 | 去掉真实姓名与学校信息 |
| `docs/教师工作台-使用说明.md` | `docs/` | 用户手册雏形 | 截图换成虚构数据版 |
| `docs/班务手册-安卓工程说明.md` | `docs/` | Capacitor 集成踩坑 | 包名换成 `io.github.beuml.zijin` |
| `README.md` §5 的 P1/P2 表 | `docs/backlog.md` | 现成的优先级 | 直接抄，再加反馈条目 |
| `scripts/ui-check.mjs`（26KB） | `scripts/` | ⭐ 现成的 E2E 检查，17 场景 | **必须**去掉硬编码绝对路径，改用 `reference/samples/` 下的虚构表 |
| `scripts/clean-check.mjs` | `scripts/` | 数据清洁度检查 | 同上 |
| `scripts/file-check.mjs` | `scripts/` | 文件产物检查 | 同上 |
| `scripts/build_seed.py` | `scripts/` | 从 Excel 生成种子数据 | **改造方向**：改成「表格结构探测器」的原型 |
| `app/src/screens/` 的页面结构 | 参考用 | 功能清单已完整 | 只作设计参照，不直接搬代码 |
| `app/src/data/seed.json` 的**字段结构** | 参考用 | 数据形态 | **只抄键名，绝不抄值** |

### `ui-check.mjs` 有一个必须改的地方

文件顶部硬编码了：

```js
const BASE = 'http://127.0.0.1:5173/';
const REAL_FILE = 'C:\\Work\\repos\\teacher\\re\\教师工作台资料\\八年级上第一次月考.xlsx';
const OUT = 'C:\\Work\\repos\\teacher\\shots';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
```

搬过来后要改成相对路径 + 环境变量，否则换台机器就跑不了。

---

## 二、绝不能搬的（禁区）

| 东西 | 原因 |
| :-- | :-- |
| `re/` 下的 `.xlsx` `.et` | 花名册、个人情况登记表、月考成绩——**原始件，最敏感** |
| `app/src/data/seed.json` | 42 个姓名字段、**18 个真实 11 位手机号**、家庭情况 |
| `shots/` 下所有截图 | 界面直接显示学生姓名 |
| `app/dist/`、`教师工作台-demo.html` | 数据已内联进产物，删源码也不消失 |
| `班务手册-v0.0.1.apk` | 同上 |
| `docs/班务手册-开发经历分享.docx` 等分享稿 | 含真实故事，需**改写**后才能公开 |
| `docs/分享稿-*.md` | 同上 |

### 一句话判断法

> **只要能用 Ctrl+F 搜到一个真实学生的名字，这个东西就不能进仓库。**

---

## 三、`samples/` —— 导入测试用的虚构样例

需要准备的样例（全部虚构，33 人）：

| 文件 | 模拟什么 |
| :-- | :-- |
| `sample-standard.xlsx` | 本学期期中表格式（两次次别 + 分层 + 导师） |
| `sample-flat.xlsx` | 单次考试、无分层、单行表头（最简格式） |
| `sample-messy.xlsx` | 多行合并表头、列名带空格、多余合计行（压力测试） |
| `sample-broken.xlsx` | 缺姓名列、分数是文本、有重复行（错误路径） |

造假数据时注意：**结构要真，数值可以假**。姓名用「张三、李四…」或固定假名表，
电话用 `13800000001` 这类明显虚构号段。

## 四、`feedback/` —— 使用者反馈

一条一个文件，命名：

```
feedback/2026-11-12-01-成绩导入识别不出分层.md
```

内容只要三行：

```md
原话：<老师说的原话，别改写>
场景：<她当时在干什么>
期望：<她希望看到什么>
```

**原话最重要。** 整理过的需求会丢掉真实痛点，而真实痛点才是判据的来源。
