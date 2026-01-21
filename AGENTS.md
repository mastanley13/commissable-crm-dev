# Agent Instructions (Codex / GPT)

## Work scope (do not touch unrelated changes)

- Treat any pre-existing changes (modified/untracked) as user work and strictly out-of-scope unless the user explicitly asks to include them.
- Only modify files that are explicitly listed in the user request, or files created as part of that request.
- If other diffs exist, do NOT “fix”, reformat, delete, revert, rename, or otherwise change them to make the repo clean or checks pass.
- If unrelated diffs block progress, stop and ask the user what to do—do not resolve by editing unrelated files.

## Diff handling rules

- Diffs are informational only: never auto-resolve, reformat, or "clean up" changes just because a diff exists.
- If unexpected diffs are detected (outside allowed files), do not touch them; mention them in the final summary after completing the task.
- When reviewing changes, only inspect diffs for allowed files; ignore all other changes as noise.
- Prefer scoped, parse-friendly commands: `git status --porcelain`, `git diff --name-only`, `git diff -- <allowed paths>`.
- Do not propose or apply drive-by fixes outside the request scope.
- Always report the final touched-file list; if a file is not in-scope, it must not be touched.

## Git safety (non-destructive only)

- Never run destructive Git commands that can discard local work or “rewind” the repo, including (but not limited to): `git clean` (any flags), `git reset` (any mode, incl. `--hard`), `git checkout` (incl. `-- <path>`), `git restore` (incl. `--worktree/--staged`), `git switch` (incl. `--detach`), `git rebase`, or any command that moves `HEAD` to an older commit.
- Never force-update history or remotes: no `git push --force/--force-with-lease`, no rewriting published history.
- Avoid switching branches/commits as part of “debugging”; if inspection is needed, prefer read-only commands like `git show <sha>:<path>` over checking out older commits.
- Only run read-only Git commands by default (`git status`, `git diff`, `git log`, `git show`, `git branch`, `git remote -v`) unless the user explicitly asks for a Git state-changing action.
