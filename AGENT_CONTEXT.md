# Workflow skills

Six skills are installed in this agent's skills directory, each as `skills/<name>/SKILL.md`:
`ezask`, `ezthink`, `ezdefine`, `ezplan`, `ezrun`, `ezcommit`.

They are command-only: load one only when the user runs its command (`/ezask`, `/ezthink`,
`/ezdefine`, `/ezplan`, `/ezrun`, `/ezcommit`) or names it explicitly. Never start a phase on your own.

Task files live in the current project at `.task/NNN.<english-task-name>.md`; completed tasks move to
`.task/archive/`.
