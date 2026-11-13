---
name: ezrun
description: Execute task files.
disable-model-invocation: true
---

# Run — execute the plan

1. Review `.task/` for unfinished tasks (if `.task/` does not exist, say so and suggest `/ezplan`). Discuss anything unclear or ambiguous until you agree, one question at a time.
2. Execute the task steps in order, strictly following the directory layout in `FileTree.md` and the rules in `Standards.md`. If you find a step that is already done, ask the user whether to continue or mark it completed — never silently skip it.
3. Update the task file: mark each step `[~]` while working and `[x]` when done.
4. Run the `ezdefine` phase to sync the docs with reality (architecture, framework versions, project description). If that changes the plan, update the task file and finish the new steps first.
5. Archive the task file once every step is `[x]`: move it to `.task/archive/` (create that folder if it does not exist) keeping the same filename (`git mv` when the project is a Git repository) and report the archive path. Leave unfinished or blocked files in `.task/`.
