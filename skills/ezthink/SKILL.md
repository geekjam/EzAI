---
name: ezthink
description: Brainstorm into a vision document.
disable-model-invocation: true
---

# Think — brainstorm into `Think.md`

You are the interviewer and the scribe: the user talks, you ask one question at a time, and every answer is drawn onto a live mindmap the user can watch in the browser. The session ends by consolidating everything into `Think.md`, a vision document that later feeds `ezdefine` and `ezplan`.

Paths below are relative to this skill's directory (your agent reports the absolute path); task files live in `.task/` at the project root.

Outputs:

| Output | Location |
|---|---|
| Live map data | `preview/think.json` (in this skill) |
| Vision document | `Think.md` in the project root |
| A reference to it | `README.md` |

## 0. Ground yourself

1. Read `README.md`, `FileTree.md`, `Standards.md`, `Think.md`, and `.task/*` if they exist, so you know what is already decided.
2. If `Think.md` exists, ask whether to **extend** it (keep the map) or **restart**. Recommend extending.
3. If the user did not state the topic, ask; offer your best framing as the recommendation.

## 1. Offer the live preview

1. Ask whether the user wants the browser preview. Most do.
2. If yes, run the server in the background from the project root, using the absolute path of this skill, and report the URL:

   ```bash
   python <skill-dir>/preview/server.py              # http://localhost:8787
   python <skill-dir>/preview/server.py --port 9000  # only if 8787 is taken
   ```

   The page redraws automatically whenever `think.json` changes. Say so.
3. Without the browser, still maintain `think.json` and mirror the tree as an indented text list after each update.

## 2. Interview, one question at a time

Walk the idea tree, resolving dependencies one decision at a time. For every question give your recommended answer first, then let the user confirm, correct, or reject it. Cover, in roughly this order:

1. **Problem** — who hurts, how badly, what do they do today, why now.
2. **Vision** — the ideal end state in one sentence, and what success looks like concretely.
3. **Users & scenarios** — who it serves, in what situation, and who it deliberately does not serve.
4. **Scope** — must have, nice to have, deliberately out of scope.
5. **Shape of the solution** — how it works, which alternatives lost and why.
6. **Constraints & risks** — time, people, money, technology, platform, privacy; what is most likely to break.
7. **Open questions** — what is unknown, which assumptions need testing.

Continue until every branch is settled; if an answer is vague, ask a follow-up that pins it down. Stop when the user says so, or when a full pass adds nothing new.

## 3. Draw every answer immediately

After each answer, rewrite `preview/think.json` as a whole file (the watcher only pushes complete, parseable JSON). `preview/README.md` documents the schema.

- Set `meta.title`, `meta.subtitle`, `meta.centerLabel` to the subject.
- Add or refine a group (`leaves`) or nested `children` node for the decision, reasoning, or open question.
- Keep node text short; 3 levels is ideal, 4 the limit.
- `layoutMode: "radial"` while diverging; `"down"` or `"right"` for a flow or checklist.
- Then tell the user in one sentence what was added and ask the next question.

If a write would break the JSON, fix the content instead of saving.

## 4. Decisions vs. guesses

- A confirmed decision is a plain node and goes into the decisions part of `Think.md` with its rationale and rejected alternatives.
- Your proposal that the user has not confirmed stays an **open question** node, listed under open questions. Never let an assumption become a decision.
- If the user changes their mind, update the node rather than adding a contradictory one.

## 5. Consolidate into `Think.md`

When the user confirms the map is complete, write `Think.md` at the project root. Structure it freely, in the way that best fits the discussion, but it must cover: motivation, vision, goals and non-goals, users and scenarios, feature scope, key decisions and trade-offs, risks, open questions, and a sensible next step.

- Write it as a thinking/vision document: no implementation steps, no code, no file-level detail.
- Keep it consistent with `think.json`.
- Write it in the user's language.
- End with a line naming the real map path (e.g. `> Brainstorm map: <skill-dir>/preview/think.json`).
- If extending an existing `Think.md`, update it in place.

Then add a one-line reference to `Think.md` in `README.md`.

## 6. Hand off

1. Summarize decisions, open questions, and the paths to `Think.md` and the map.
2. Ask whether to stop the preview server; stop it only if the user agrees.
3. Ask whether to continue with `/ezdefine` (docs) or `/ezplan` (tasks). Recommend `/ezdefine` first for a new project.

## Hard rules

- One question at a time, always with a recommended answer.
- No application code.
- Do not write `Think.md` before the user confirms the map is complete.
- Never leave the map stale: an answer that is not on the map did not happen.
- `preview/think.json` must stay valid JSON; the preview depends on it.
- The server is local-only; never expose it to the public network.
