# Claude Code: The Autonomous Performer

## Local Environment
- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Test**: `npm test`

## Responsibilities
- **Refactoring**: Use `useRef` (gameRef) for all chess logic to prevent stale closures.
- **Handoff**: Monitor `postbox/todo.md`. If a task is assigned to you, execute it, move it to `done.md`, and commit changes.
- **Git**: Follow Conventional Commits (e.g., `feat:`, `fix:`, `docs:`).

## Commit
You are authorized to push directly. Always use ./commit.sh to ensure the pre-commit audit is triggered.