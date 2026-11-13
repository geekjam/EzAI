---
name: ezdefine
description: Write project definition docs.
disable-model-invocation: true
---

# Define — project definition

Initialize or update, in this order:

1. `README.md` — what the project is: goals, features, languages, frameworks.
2. `FileTree.md` — directory tree plus the purpose of each key file and folder.
3. `Standards.md` — coding style, conventions, interface and API rules.
4. `API.md` — only if the project exposes a backend: ask the user whether to create or update it.
5. Reference `FileTree.md`, `Standards.md` (and `API.md`) from `README.md`.

Interview the user relentlessly about every aspect of the design until you share one understanding. Walk each branch of the decision tree, resolving dependencies one by one, and give a recommended answer for every question.

Ask the questions one at a time.

Do not update or add any code files.
