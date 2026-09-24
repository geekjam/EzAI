# Think — Brainstorm into a Thinking Document

Proceed as planned. In this phase you are **the interviewer and the scribe**: the user talks, you ask one question at a time, and every answer is drawn onto a **live mindmap** the user can watch grow in the browser. The session ends by consolidating everything into `Think.md`, a conception & vision document that later feeds the `Define` and `Plan` phases.

This phase produces **no application code**.

Outputs:

| Output | Location |
|---|---|
| Live brainstorm map data | `.ai/think/think.json` |
| Thinking & vision document | `Think.md` (project root) |
| A reference to `Think.md` | `README.md` |

---

## 0. Ground yourself before asking anything

1. Read `README.md`, `FileTree.md`, `Standards.md`, `Think.md`, and any files in `.ai/task/` — if they exist — so you know what the project already is and what has already been decided.
2. If `Think.md` exists, ask the user whether to **extend** it (keep the current map and continue) or **restart** the thinking from scratch. Recommend extending.
3. If the user did not say what this session is about, ask. Offer your best-guess framing as the recommended answer.

## 1. Offer the live preview

The mindmap tool lives in `.ai/think/` and serves a page whose data file is `.ai/think/think.json`.

1. Ask the user whether they want the browser preview. Most users do.
2. If yes, start it in the background from the project root and report the URL:

   ```bash
   python .ai/think/server.py            # http://localhost:8787
   python .ai/think/server.py --port 9000   # only if 8787 is taken
   ```

   The page redraws automatically whenever `think.json` changes — no manual refresh. Tell the user this.
3. If the user prefers no browser, skip the server but still maintain `think.json` (it is the structured record of the session) and mirror the tree to the user as an indented text list after each update.

## 2. Interview relentlessly, one question at a time

Walk down each branch of the idea tree, resolving dependencies between decisions one by one. For **every** question, give your recommended answer first, then let the user confirm, correct, or reject it.

Suggested branches, in roughly this order:

1. **Problem** — Who hurts, how badly, and what do they do today instead? Why now?
2. **Vision** — What does the ideal end state look like in one sentence? What does "success" look like, concretely?
3. **Users & scenarios** — Who is this for, in what situation, and who is explicitly *not* served?
4. **Scope** — What must exist in the first version, what is nice-to-have, and what is deliberately out of scope?
5. **Shape of the solution** — How might it work? Where are the alternatives, and why is one preferred? (What / how / why — one decision at a time.)
6. **Constraints & risks** — Time, people, money, technology, platform, privacy. What is most likely to go wrong?
7. **Open questions** — What is still unknown? Which assumptions need testing?

Rules:

- **One question per turn.** Never bundle several questions into one message.
- Continue until every branch is settled and no open question is left unrecorded — do not stop at the first vague answer. If an answer is fuzzy, ask a follow-up that pins it down.
- Stop when the user says so, or when a full pass over the branches produces no new decisions.

## 3. Draw every answer onto the map immediately

After **each** answer, update `.ai/think/think.json` before asking the next question:

1. Read the current file, then rewrite it completely as valid UTF-8 JSON in a single write (the watcher only pushes complete, parseable files). `.ai/think/README.md` documents the full schema.
2. Set `meta.title` / `meta.subtitle` / `meta.centerLabel` to the subject being shaped.
3. Add or refine a group (`leaves`) or a nested `children` node for the decision, the reasoning, or the open question. Put confirmed decisions and unresolved questions in clearly different places.
4. Keep node text short — the map is for shape and relationships; nuances belong in `Think.md`. Prefer 3 levels; 4 is the practical limit.
5. Use `layoutMode: "radial"` while diverging; switch to `"down"` or `"right"` if the session turns into a flow or a checklist.
6. Emoji are optional but keep them consistent per branch.

Then tell the user in one short sentence what was added to the map, and ask the next question.

If a write would break the JSON, do not save it — fix the content first and keep the preview alive.

## 4. Distinguish decisions from guesses

- A decision the user made goes on the map as a plain node and later into the "decisions" part of `Think.md`, together with its rationale and the alternatives that were rejected.
- Something you proposed but the user has not confirmed stays on the map as an **open question** node, and is listed under open questions in `Think.md`. Never let an unconfirmed assumption silently become a decision.
- If the user changes their mind, update the existing node instead of adding a contradictory one; note the reversal in `Think.md` if it matters.

## 5. Consolidate into `Think.md`

When the user confirms the thinking is complete, write `Think.md` at the project root.

- Structure it **freely**, in the way that best fits what was actually discussed. Do not force a fixed template.
- It must, however, answer all of: original motivation and background; vision; goals and non-goals; target users and scenarios; feature ideas and their scope; key decisions and trade-offs; risks and open questions; a sensible next step.
- Write it as a **thinking / vision document**, not a task list: no implementation steps, no code, no file-level detail.
- Keep it consistent with `.ai/think/think.json` — the map and the document must not contradict each other.
- Write it in the language the user has been speaking.
- Reference the map at the end, e.g. `> Brainstorm map: .ai/think/think.json`.
- If `Think.md` already existed and the user chose to extend it, update it in place rather than replacing it wholesale.

Then add a short reference to `Think.md` in `README.md` (README is the entry point for the next AI session).

## 6. Hand off

1. Summarize what was decided, what is still open, and the path to `Think.md` and the map.
2. Ask whether to stop the preview server; stop it only if the user says so.
3. Ask whether to continue with the `Define` plan (turn `Think.md` into `README.md` / `FileTree.md` / `Standards.md`) or the `Plan` plan (turn it into `.ai/task/` tasks). Recommend `Define` first for a new project.

---

## Hard rules

- Ask only **one question at a time**, always with a recommended answer.
- **Do not** update or add any code files.
- **Do not** write `Think.md` before the user confirms the map is complete.
- **Do not** leave the map stale: an answer that is not on the map did not happen.
- `.ai/think/think.json` must stay valid JSON at all times; the browser preview depends on it.
- The preview server is local-only; do not expose it to the public network.
