Proceed as planned:
1. Check whether the user is currently in a Git repository; if not, first ask the user if they want to initialize Git. If they decline, stop executing this plan.
2. By default, generate a commit based on the most recently modified and newly added but uncommitted files. First, ask the user if they want to use this approach.
3. If a “Standards.md” document exists that specifies guidelines for commit content, the generated commit must follow those guidelines.
4. Ask whether the user wants to simply commit without pushing or commit and push. If the user chooses to simply commit, report the specific commit details to the user after committing and ask if they want to proceed with pushing.

Please ask only one question at a time.

(Do not mention “Authored-By/Co-Authored-By Claude,” “ChatGPT,” or “Codex” in the commit.)