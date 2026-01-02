# Agent Instructions (Codex / GPT)

## Git safety (non-destructive only)

- Never run destructive Git commands that can discard local work or “rewind” the repo, including (but not limited to): `git reset` (any mode), `git reset --hard`, `git clean -fd/-fdx`, `git checkout -- <path>`, `git restore --worktree/--staged`, `git switch --detach`, `git rebase`, or any command that moves `HEAD` to an older commit.
- Never force-update history or remotes: no `git push --force/--force-with-lease`, no rewriting published history.
- Avoid switching branches/commits as part of “debugging”; if inspection is needed, prefer read-only commands like `git show <sha>:<path>` over checking out older commits.
- Only run read-only Git commands by default (`git status`, `git diff`, `git log`, `git show`, `git branch`, `git remote -v`) unless the user explicitly asks for a Git state-changing action.

