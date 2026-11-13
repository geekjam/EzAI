---
name: ezcommit
description: Create a git commit.
disable-model-invocation: true
---

# Commit — make the commit

1. Check that the current directory is a Git repository. If not, ask whether to initialize one; if the user declines, stop.
2. Default scope: the most recently modified files plus newly added, uncommitted files. Confirm this scope with the user first.
3. If `Standards.md` defines commit guidelines, follow them.
4. Before committing, show the planned commit message and the file list.
5. Ask whether to commit only or commit and push. After a commit-only run, report the commit details and ask whether to push.

Ask one question at a time.

Never mention AI authorship in the commit (`Co-Authored-By`, "Generated with", tool names).
