# AGENTS.md —— 给在子衿仓库里工作的智能体

> 先读这份，再读 `docs/handoff.md`。两份读完再动手。

## 这是什么

**子衿**：面向中学班主任 / 导师的手机优先工作台（安卓为主）。
本机保存、无需登录、不上传任何学生数据。

前身是 `C:\Work\repos\teacher`（班务手册 v0.0.1）。本仓库是它的**正式化重写**，
不是 fork。参考 teacher 的**经验**，不复用它的**结构**。

## 立刻要记住的三条硬约束

1. **仓库里不许出现任何真实学生数据。**
   姓名、家长电话、家庭情况、真实成绩、真实学校名——一律禁止。
   测试只用 `reference/samples/` 下的虚构样例。
   判断法：**能用 Ctrl+F 搜到一个真实人名，就不许提交。**

2. **名次只在同一个排名池内可比。**
   见 `docs/design-data.md`。展示名次必须带池标签（「二层内第 5 名」），
   不许裸写「第 5 名」，不许跨池比较。

3. **本地优先。**
   不接云端大模型 API，不让老师配置 API key，不上传成绩。

## 目录

```
docs/
  design-ui.md      界面规范：色彩 / 排版 / 密度 / 组件 / 打印
  design-data.md    数据模型：实体、排名池、四段导入管线
  handoff.md        本次交接的任务与边界（先读这个再动手）
reference/
  README.md         从 teacher 搬什么、绝不搬什么
  samples/          4 份虚构成绩表，测试靶子
  feedback/         使用者反馈原文
```

## 技术栈（沿用 teacher 已验证的组合）

- **前端**：React + TypeScript + Vite
- **打包**：Capacitor → 安卓 APK
- **存储**：目标是 IndexedDB（**不要用 localStorage**，5MB 上限撑不住，见 design-data.md 第四节）
- **测试**：纯函数用 Vitest；端到端用 Chrome DevTools 协议（参考 teacher 的 `scripts/ui-check.mjs`）

## 架构铁律：计算与界面分离

```
domain/     纯函数：成绩计算、排名池、汇总、导入管线的四个阶段
ui/         只调用 domain，不写业务规则
```

**`domain/` 里不许出现 React、DOM、`window`、`localStorage`。**
理由：纯函数才能被单测覆盖，能被单测覆盖才能被夜间自动化验证。
违反这条，所有自动化都会失效。

## 常用命令

```bash
npm install
npm run dev        # 本地开发，默认 5173
npm run build      # 构建单文件
npx vitest run     # 单测（闸门）
```

## 工作方式

- **一个任务一个分支**，任务完成且闸门通过再合。
- **提交前跑闸门**：`npx vitest run` 必须全绿。
- **不发布、不打 tag、不推送 Release。**
- 改数据结构、改迁移逻辑、改包名——这三件事**必须先问人**。

## 禁区

- `C:\Work\repos\teacher\` 下的 `re/`、`shots/`、`app/dist/`、`*.apk`、`seed.json`
  ——含真实数据，**只读都不必读**，不要 `ls` 进去。
- 不要修改 `C:\Work\repos\` 下的**任何其他仓库**。
- 不要安装全局 npm 包。
