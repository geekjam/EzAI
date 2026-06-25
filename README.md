# Easy AI Workflow (.ai)

A workflow that breaks AI collaboration into **plan files**. Each phase has its own `.md` plan file. In Claude, you simply name the plan to execute, and the AI follows the steps written in that file.

> Goal: **easy to read, easy to understand, easy to change.**

> 中文版说明请参阅 [README_Chi.md](README_Chi.md)（中文版本）。

---

## Workflow Overview

A development run is split into three phases, each with one plan file:

| Phase | Plan File | What it does | Output |
|---|---|---|---|
| 1. Define Project | `.ai/DefineProject.md` | Clarify project goals, tech stack, directory structure, conventions | `README.md`, `FileTree.md`, `Standards.md` |
| 2. Make Work | `.ai/MakeWork.md` | Break the work into steps, ask questions item by item | `.ai/task/N.xxTask.md` task lists |
| 3. Do Work | `.ai/DoWork.md` | Execute the task list step by step, write status back | Code + updated task lists |

Flow: **DefineProject → MakeWork → DoWork → (on deviation) back to DefineProject to sync docs**.

---

## Directory Structure

```
project-root/
└── .ai/
    ├── README.md          # This file
    ├── DefineProject.md   # Phase 1: define project
    ├── MakeWork.md        # Phase 2: make work plan
    ├── DoWork.md          # Phase 3: do work plan
    └── task/              # task plan files
        ├── 1.xxTask.md
        └── 2.xxxTask.md
```

---

## Usage

### Step 1: Copy the `.ai` folder into your project root

Just copy the whole folder over. No configuration needed.

### Step 2: Tell Claude which plan to execute

Use plain natural language to tell Claude which plan file to run, for example:

- **`execute .ai\DefineProject plan`**
  Start defining/updating the project, generating `README.md`, `FileTree.md`, `Standards.md`.

- **`execute .ai\MakeWork plan`**
  Make a task plan based on the current project state, producing `.ai/task/N.xxTask.md`.
  If the project code hasn't been initialized yet, the default task is "initialize the project".

- **`follow .ai\MakeWork plan to add feature xxx`**
  Make a task plan with a specific requirement in mind, breaking "add feature xxx" into executable steps.

- **`execute .ai\DoWork plan`**
  Execute items in `.ai/task/` one by one, updating status as you go.
  When everything is done, it automatically runs `DefineProject` again to sync architecture / framework version changes back into the docs.

> The plan file itself is the instruction for the AI. When Claude sees "execute plan X", it opens `.ai/X.md` and follows the steps written there.

---

## Task List Status Convention

Each item in a task plan `.md` file is prefixed with a status marker:

| Marker | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |

File naming: `number + task name`, e.g. `1.initialize-project`, `2.user-login-module`.

---

## How to Change It

This workflow has no code — it's all Markdown. To change plan behavior, just edit the three `.md` files under `.ai/`:

- To change what **Define Project** asks → edit `DefineProject.md`
- To change how **Make Work** works → edit `MakeWork.md`
- To change the **Do Work** flow → edit `DoWork.md`

The task plan template is described inside `MakeWork.md`. Changing the naming / status conventions there affects all newly generated task files.

---

## Design Notes

1. **One file per phase** — single responsibility; you know what each step does at a glance.
2. **Plan file as instruction** — no scripts, no config; Claude just reads the Markdown and executes.
3. **Forced question alignment** — both `DefineProject` and `MakeWork` require the AI to ask questions one at a time until everything is clear, preventing misunderstanding.
4. **Write docs back after execution** — `DoWork` runs `DefineProject` at the end so docs and code never drift apart.
5. **No code changes until it's time** — the first two phases explicitly forbid editing code; project and tasks get clarified first.
