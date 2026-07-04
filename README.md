# Easy AI Workflow (.ai)

A workflow that turns AI-assisted development into **editable Markdown plan files**. Each phase has its own `.md` plan file. In your AI coding assistant (such as Claude Code or Codex), you simply name the plan to execute, and the assistant follows the steps written in that file.

> Make AI-assisted development predictable by turning project definition, task planning, and task execution into editable Markdown plans.

> 中文版说明请参阅 [README_Chi.md](README_Chi.md).

---

## Quick Start

1. Copy the `.ai` folder into your project root. No configuration needed.
2. Tell your AI coding assistant: **`execute .ai\DefineProject plan`**
   The assistant will start defining/updating the project and generate `README.md`, `FileTree.md`, `Standards.md`.

That's it — the plan file itself is the instruction. The assistant reads `.ai/X.md` and follows the steps written there.

---

## Workflow Overview

A development run is split into three phases, each with one plan file:

| Phase | Plan File | What it does | Output |
|---|---|---|---|
| 1. Define Project | `.ai/DefineProject.md` | Clarify project goals, tech stack, directory structure, conventions | `README.md`, `FileTree.md`, `Standards.md` |
| 2. Make Work | `.ai/MakeWork.md` | Break the work into steps, ask questions item by item | `.ai/task/N.xxTask.md` task lists |
| 3. Do Work | `.ai/DoWork.md` | Execute the task list step by step, write status back | Code + updated task lists |

Flow: **DefineProject → MakeWork → DoWork → (on deviation) back to DefineProject to sync docs**.

`DefineProject` always produces `FileTree.md` and `Standards.md`. If the project exposes a backend API, the plan will also ask whether to generate or update `API.md`.

## Make Commit (Optional)

After `DoWork` (or at any point where work is ready to commit), run:

**`execute .ai\MakeCommit plan`**

The assistant checks whether the current directory is a Git repository, generates a commit from the most recently modified and newly added uncommitted files, and follows `Standards.md` if it specifies commit guidelines. It then asks whether to push, or whether to commit without pushing.

---

## Directory Structure

```
project-root/
└── .ai/
    ├── README.md          # Workflow README (this folder)
    ├── DefineProject.md   # Phase 1: define project plan
    ├── MakeWork.md        # Phase 2: make work plan
    ├── DoWork.md          # Phase 3: do work plan
    ├── MakeCommit.md      # Optional: make Git commit plan
    └── task/              # task plan files
        ├── 1.xxTask.md
        └── 2.xxxTask.md
```

---

## Programming Languages and Frameworks

This project ships **no runtime code**. The core assets are Markdown plan files. They are executed by an AI coding assistant (such as Claude Code or Codex) that reads local files and follows the instructions inside.

There are no build tools, package managers, or runtime dependencies to install.

---

## Features

1. **Phased plan files** — `DefineProject` / `MakeWork` / `DoWork` split a development run into three phases; the assistant asks questions item by item before doing any work.
2. **Plan file as instruction** — trigger a phase with plain natural language like `execute .ai\DefineProject plan`; no scripts or config files required.
3. **Task list tracking** — `.ai/task/` holds task plans with `[ ]` / `[~]` / `[x]` status markers and `number + task name` file naming.
4. **Docs write-back** — `DoWork` runs `DefineProject` again at the end so architecture / framework changes flow back into `README` / `FileTree` / `Standards`.
5. **Zero runtime dependencies** — everything is Markdown. Copy the folder and edit `.md` files to change behavior.
6. **Optional Git commit helper** — `MakeCommit` reads recently modified and newly added untracked files, follows `Standards.md` commit guidelines if present, and asks whether to push.

---

## Prerequisites

- An AI coding assistant that can read local files and follow Markdown instructions (Claude Code or Codex both work).
- Basic familiarity with Markdown.
- No Node, Python, .NET, or any other runtime environment is required.

---

## Applicable Scenarios

- Starting a new project from scratch with AI assistance.
- Bringing a structured AI collaboration process into an existing project.
- Unifying AI instructions and task-tracking format across a team.

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
2. **Plan file as instruction** — no scripts, no config; the assistant just reads the Markdown and executes.
3. **Forced question alignment** — both `DefineProject` and `MakeWork` require the assistant to ask questions one at a time until everything is clear, preventing misunderstanding.
4. **Write docs back after execution** — `DoWork` runs `DefineProject` at the end so docs and code never drift apart.
5. **No code changes until it's time** — the first two phases explicitly forbid editing code; project and tasks get clarified first.
