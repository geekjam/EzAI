# Easy AI Workflow (skills)

Six Agent Skills plus slash commands: `/ezask`, `/ezthink`, `/ezdefine`, `/ezplan`, `/ezrun`, `/ezcommit`. Install once into your agent's skill and command directories, then use them in any project.

Every command carries the `ez` prefix so it cannot collide with a host tool's built-ins (many tools already ship `/plan` or `/commit`).

> 中文版说明请参阅 [README_Chi.md](README_Chi.md).

---

## Install

This repository is a plain skill pack: nothing to build, no dependencies, no lock-in to a specific agent. Install it wherever your agent looks for skills and prompts.

1. **Skills** — copy (or symlink) each folder under `skills/` into your agent's skills directory, at user or project scope as your agent documents:

   ```bash
   cp -r skills/* <agent skills dir>/     # path depends on your agent
   ```

2. **Commands** — copy `prompts/*.md` into the prompt/command directory your agent exposes as slash commands. The file name becomes the command, so `/ezask` … `/ezcommit` work unchanged.

3. **Context hint (recommended, required if the agent hides `disable-model-invocation` skills)** — append `AGENT_CONTEXT.md` to whatever system-prompt or context file your agent loads. It tells the model that the skills exist, where they live, and that they must only run on command.

Agents without a prompt-template mechanism can still use the workflow by naming a skill in plain language ("use the `ezplan` skill"). Reload or restart the agent after installing or editing files.

- No build step, no package manager. The only optional runtime is the `ezthink` preview server (Python 3.9+, standard library only).

---

## Commands

| Command | Skill | What it does | Output |
|---|---|---|---|
| `/ezask` | `ezask` | Read-only Q&A and discussion. Never writes files. | — |
| `/ezthink` | `ezthink` | Interviews you into a live mindmap, then a vision document. | `Think.md` |
| `/ezdefine` | `ezdefine` | Clarifies goals, stack, structure, conventions. | `README.md`, `FileTree.md`, `Standards.md`, optional `API.md` |
| `/ezplan` | `ezplan` | Breaks a goal into ordered, checkable steps. | `.task/NNN.<english-task-name>.md` |
| `/ezrun` | `ezrun` | Executes an unfinished task file and updates its statuses. | Code + task file, archived when done |
| `/ezcommit` | `ezcommit` | Builds a commit, asks about push. | Git commit |

Arguments are appended to the skill instructions, e.g. `/ezplan user login`, `/ezrun 003`, `/ezask "why SQLite here?"`.

Flow: **`/ezthink` → `/ezdefine` → `/ezplan` → `/ezrun` → `/ezcommit`**, and back to `/ezdefine` whenever reality deviates from the docs (`/ezrun` does this automatically).

---

## Layout

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
│       └── preview/          # live mindmap server (Python stdlib)
├── prompts/                  # /ezask … /ezcommit (thin wrappers, no paths)
│   └── ezask.md
├── AGENT_CONTEXT.md          # optional context hint: where the skills are, never auto-run
├── README.md
└── README_Chi.md
```

No task files live in this repository. `.task/` is created in whichever project you run `/ezplan` in:

```
your-project/
└── .task/
    ├── 001.initialize-project.md
    └── archive/              # completed tasks, kept as history
```

Installed, this maps onto:

```
<agent dir>/
├── skills/{ezask,ezthink,ezdefine,ezplan,ezrun,ezcommit}/
├── prompts/{ezask,ezthink,ezdefine,ezplan,ezrun,ezcommit}.md
└── AGENT_CONTEXT.md          # or its content appended to your agent's context file
```

---

## Why nothing fires on its own

Each skill sets `disable-model-invocation: true`, so an agent that honors the flag never offers it for automatic selection. Phase skills are entered only by command, which keeps a discussion from silently turning into a plan or a commit.

A skill's `description` is therefore deliberately three or four words: it is documentation for humans, not a trigger. The command wrappers in `prompts/` are path-free; the single place that says where skills live is `AGENT_CONTEXT.md`.

---

## Task file convention

- Name: `NNN.<english-task-name>.md` with a fixed-width, zero-padded three-digit number (`001`, `002`, `010`, …) so filename sorting matches numeric order.
- Status markers per step:

| Marker | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Completed |

When every step is `[x]`, `/ezrun` moves the file to `.task/archive/` with the same name (`git mv` when tracked). Archived files are read-only history: they keep their number forever, and new task numbers count them too, so numbers are never reused.

---

## Customizing

Everything is Markdown:

- Change a phase's behavior → edit `skills/<name>/SKILL.md`.
- Change a command's hint or description → edit `prompts/<name>.md`.
- Rename a skill → move its folder, update `AGENT_CONTEXT.md`, and update the wrapper in `prompts/`; nothing else references the old name.
- Reload or restart your agent after editing an installed copy.
- Prefer project scope over global? Install `skills/` and `prompts/` in the project's agent configuration directory instead, following that agent's documentation.

---

## Design notes

1. **One skill per phase** — single responsibility, readable in under a minute.
2. **Explicit entry only** — no auto-trigger, no surprise edits; `/ezask` is guaranteed read-only.
3. **Questions before code** — `/ezthink`, `/ezdefine`, and `/ezplan` forbid code changes and ask one question at a time, each with a recommended answer.
4. **Docs write back, work gets archived** — `/ezrun` ends by re-running `/ezdefine` and moving the finished task to `.task/archive/`, so docs, code, and history stay in sync.
5. **Portable core** — plain Markdown plus one optional Python preview; no package manager.
