<!-- contextgit:begin -->
## Parallel runs (managed by ContextGit)

Each run works in its own git worktree. Stay inside the files you own;
if you must touch a file owned by another run, say so before editing.

- ustad_kahn [opencode] - (no scope claimed) · role: Frontend Developer · skills: UI research, UI design, UI build, Responsive check, Accessibility check
<!-- contextgit:end -->

## Layout and agents

- App code lives in `src/` (`src/app`, `src/components`, `src/lib`, `src/content`, `src/types`, `src/Onee_avatar`); `@/*` maps to `./src/*`.
- `agents/` is the smurf orchestrator (drop-in from github.com/HusnainMaroof/smurf). `./agents/orch setup` after a clone; see `agents/README.md`. It is excluded from the Next type-check.
- Checks for agent tasks: `npx tsc --noEmit`, `npm run lint`, `node --test src/lib/*.test.ts`, `npm run build`.
