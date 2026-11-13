# 简单易用 AI 工作流（skills）

六个 Agent Skill + 斜杠命令：`/ezask`、`/ezthink`、`/ezdefine`、`/ezplan`、`/ezrun`、`/ezcommit`。装一次到你的 agent 的 skills / 命令目录，之后任何项目都能用。

所有命令都带 `ez` 前缀，避免与宿主工具自带命令撞名（很多工具本身就占用 `/plan` 或 `/commit`）。

> English version: [README.md](README.md).

---

## 安装

本仓库只是普通的 skill 包：无需构建、无依赖、不绑定特定 agent。把它装到你的 agent 查找 skills 和命令的位置即可。

1. **Skills** —— 把 `skills/` 下的每个目录复制（或符号链接）到 agent 的 skills 目录，用户级还是项目级按该 agent 的文档决定：

   ```bash
   cp -r skills/* <agent 的 skills 目录>/     # 路径取决于你的 agent
   ```

2. **命令** —— 把 `prompts/*.md` 复制到 agent 暴露为斜杠命令的 prompt/command 目录。文件名即命令名，因此 `/ezask` … `/ezcommit` 无需修改。

3. **上下文提示（建议；若 agent 不列出被隐藏的 skill 则必须）** —— 把 `AGENT_CONTEXT.md` 追加到 agent 加载的 system prompt 或上下文文件。它告诉模型这些 skill 存在、在哪里，且只能用命令触发。

没有命令模板机制的 agent 也能用：用自然语言点名 skill（“使用 `ezplan` skill”）。安装或修改文件后重载或重启 agent。

- 无需构建、无需包管理器。唯一可选的运行时是 `ezthink` 的预览服务（Python 3.9+，仅标准库）。

---

## 命令

| 命令 | Skill | 做什么 | 产出 |
|---|---|---|---|
| `/ezask` | `ezask` | 只读问答与讨论，绝不写文件 | — |
| `/ezthink` | `ezthink` | 一问一答画出实时脑图，最后整理成愿景文档 | `Think.md` |
| `/ezdefine` | `ezdefine` | 明确目标、技术栈、结构、规范 | `README.md`、`FileTree.md`、`Standards.md`，可选 `API.md` |
| `/ezplan` | `ezplan` | 把目标拆成有序、可勾选的步骤 | `.task/NNN.<english-task-name>.md` |
| `/ezrun` | `ezrun` | 执行未完成的任务清单并回写状态 | 代码 + 任务清单，完成即归档 |
| `/ezcommit` | `ezcommit` | 生成提交，询问是否推送 | Git 提交 |

命令后的参数会附加到 skill 指令后面，例如 `/ezplan user login`、`/ezrun 003`、`/ezask "为什么这里用 SQLite？"`。

流程：**`/ezthink` → `/ezdefine` → `/ezplan` → `/ezrun` → `/ezcommit`**；发现实现与文档有偏差时回到 `/ezdefine`（`/ezrun` 结束时自动做一次）。

---

## 目录结构

```
EzAI/
├── skills/
│   ├── ezask/SKILL.md
│   ├── ezcommit/SKILL.md
│   ├── ezdefine/SKILL.md
│   ├── ezplan/SKILL.md
│   ├── ezrun/SKILL.md
│   └── ezthink/
│       ├── SKILL.md
│       └── preview/          # 实时脑图预览服务（Python 标准库）
├── prompts/                  # /ezask … /ezcommit（极薄包装，不写路径）
│   └── ezask.md
├── AGENT_CONTEXT.md          # 可选上下文提示：skills 在哪、绝不自动执行
├── README.md
└── README_Chi.md
```

本仓库不存放任何任务文件。`.task/` 会在你运行 `/ezplan` 的那个项目里创建：

```
你的项目/
└── .task/
    ├── 001.initialize-project.md
    └── archive/              # 已完成任务，保留为历史
```

安装后对应关系：

```
<agent 目录>/
├── skills/{ezask,ezthink,ezdefine,ezplan,ezrun,ezcommit}/
├── prompts/{ezask,ezthink,ezdefine,ezplan,ezrun,ezcommit}.md
└── AGENT_CONTEXT.md          # 或把内容追加到 agent 的上下文文件
```

---

## 为什么不会自己触发

每个 skill 都设置了 `disable-model-invocation: true`，支持该标志的 agent 不会把它放进可自动选择的列表，阶段只能由命令进入。这样讨论就不会悄悄变成计划、计划不会悄悄变成提交。

也正因如此，skill 的 `description` 只写三四个词：它给人看，不承担触发职责。`prompts/` 里的命令包装不写任何路径；「skills 在哪里」只在 `AGENT_CONTEXT.md` 里声明一次。

---

## 任务文件约定

- 命名：`NNN.<english-task-name>.md`，三位左侧补零（`001`、`002`、`010`……），保证按字符串排序与数字顺序一致。
- 每一步前用状态标记：

| 标记 | 含义 |
|---|---|
| `[ ]` | 未开始 |
| `[~]` | 进行中 |
| `[x]` | 已完成 |

当所有步骤都是 `[x]` 时，`/ezrun` 会把文件原名移到 `.task/archive/`（Git 仓库里用 `git mv`）。归档文件是只读历史：序号永久保留，新序号也会把归档算进去，因此编号不会重用。

---

## 怎么改

全部是 Markdown：

- 改某阶段的行为 → 编辑 `skills/<name>/SKILL.md`。
- 改命令的提示或描述 → 编辑 `prompts/<name>.md`。
- 重命名 skill → 移动目录、更新 `AGENT_CONTEXT.md` 和 `prompts/` 里对应的包装文件，其他位置不再引用旧名。
- 改完安装好的副本后重载或重启 agent。
- 只想在单个项目生效？按该 agent 的文档，把 `skills/` 与 `prompts/` 装到项目的配置目录里。

---

## 设计要点

1. **一个阶段一个 skill** —— 职责单一，一分钟能读完。
2. **只能显式进入** —— 不自动触发、不会意外改文件；`/ezask` 保证只读。
3. **先问清楚再动手** —— `/ezthink`、`/ezdefine`、`/ezplan` 禁止改代码，每次只问一个问题，并给出推荐答案。
4. **执行后回写文档并归档** —— `/ezrun` 收尾会再跑一次 `/ezdefine`，并把已完成任务移入 `.task/archive/`，文档、代码与历史保持一致。
5. **核心零依赖** —— 纯 Markdown，外加一个可选的 Python 预览。
