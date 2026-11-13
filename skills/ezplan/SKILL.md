---
name: ezplan
description: Turn a goal into task files.
disable-model-invocation: true
---

# Plan — task planning

1. Determine the task from the user's input. If no specific task is given and the code described in `README.md` does not exist yet, the default task is to initialize the project.
2. Ask the user which task to perform, one question at a time, with your recommendation.
3. Break the task into ordered steps, interrogating the user in depth until you agree on the details. Then write the task file in `.task/`, creating that folder first if it does not exist.

Task files live in `.task/`:

- Name: `NNN.<english-task-name>.md` — fixed-width, zero-padded three-digit sequence number (`001`, `002`, `010`, …), so lexicographic sorting matches numeric order. Next number = highest existing across `.task/` and `.task/archive/`, plus one, so numbers are never reused.
- One line per step, each prefixed with a status marker: `[ ]` not started, `[~]` in progress, `[x]` completed.
- Keep the file short enough to rerun from: each step names the file or area it touches.
- Completed files are moved to `.task/archive/` by `ezrun`; treat them as read-only history.

Do not update or add any code files.
