# AI Workflow (.ai)

A workflow that turns AI-assisted development into **editable Markdown plan files**. Each phase maps to one `.md` plan file; tell the AI assistant which plan to execute and it follows the steps written in that file.

> Goal: **easy to read, easy to understand, easy to modify.**

---

## Workflow Overview

A development run is split into three phases, each backed by one plan file:

| Phase | Plan file | What it does | Output |
|---|---|---|---|
| 1. Define | `.ai/Define.md` | Clarify project goals, tech stack, directory structure, and standards | `README.md`, `FileTree.md`, `Standards.md` |
| 2. Plan | `.ai/Plan.md` | Break work into steps and ask clarifying questions item by item | `.ai/task/N.xxTask.md` task list |
| 3. Run | `.ai/Run.md` | Execute the task list step by step and write back statuses when done | Code + updated task list |

Flow: **Define → Plan → Run → (on deviation) back to Define to sync docs**.

---

## Directory Structure

```
project root/
└── .ai/
    ├── README.md          # This file
    ├── Define.md          # Phase 1: define the project
    ├── Plan.md            # Phase 2: plan the tasks
    ├── Run.md             # Phase 3: execute the tasks
    └── task/              # Task plan files
        ├── 1.xxTask.md
        └── 2.xxxTask.md
```

---

## How to Use

### Step 1: Copy the `.ai` folder into your project root

Just copy the whole folder over — no configuration needed.

### Step 2: Tell the AI assistant which plan to execute

Use plain natural language, for example:

- **`execute .ai/Define plan`**
  Define/update the project and generate `README.md`, `FileTree.md`, `Standards.md`.

- **`execute .ai/Plan plan`**
  Create a task plan based on the current project state and generate `.ai/task/N.xxTask.md`.
  If project code has not been initialized yet, the default task is to initialize the project.

- **`execute .ai/Plan plan with feature xxx`**
  Create a task plan with a specific requirement, splitting "feature xxx" into executable steps.

- **`execute .ai/Run plan`**
  Execute the tasks in `.ai/task/` one by one and update statuses when done.
  On completion, it automatically runs `Define` again so architecture/framework changes flow back into the docs.

> The plan file itself is the instruction for the AI. When the assistant reads "execute X plan", it opens `.ai/X.md` and follows the steps written there.

---

## Task List Status Conventions

Each item in a task plan `.md` file is prefixed with a status marker:

| Marker | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Completed |

File naming: `number + English task name`, e.g. `1.xxTask`, `2.xxxTask`.

---

## How to Modify

This workflow has no code — it's all Markdown. To change the behavior of the plans, edit the three `.md` files under `.ai/`:

- Want to change what **Define** asks about → edit `Define.md`
- Want to change how **Plan** works → edit `Plan.md`
- Want to change the **Run** flow → edit `Run.md`

The task plan template is described in `Plan.md`; change the naming/status conventions there to affect all newly generated task files.

---

## Design Principles

1. **One file per phase** — single responsibility; a glance tells you what this phase does.
2. **Plan file as instruction** — no scripts, no config; the AI reads Markdown and executes.
3. **Mandatory questioning** — `Define` and `Plan` require the AI to ask questions one by one until things are clear, avoiding misunderstandings.
4. **Docs write-back after execution** — `Run` runs `Define` at the end so docs and code stay in sync.
5. **No code until it's time** — the first two phases explicitly forbid changing code; think the project and tasks through first.
