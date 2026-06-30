Proceed as planned:
1. Check if the current directory is within a Git repository; if not, stop this process.
2. By default, generate a commit based on the most recently modified and newly added but uncommitted files. First, ask the user if they want to use this approach.
3. Ask whether the user wants to simply commit without pushing or commit and push. If the user chooses to simply commit, report the specific commit details to the user after committing and ask if they want to proceed with pushing.

Please ask only one question at a time.

(Do not mention “Authored-By/Co-Authored-By Claude,” “ChatGPT,” or “Codex” in the commit.)