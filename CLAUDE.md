# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- `.claude/settings.json` runs `npm run orient` on SessionStart, so a new chat already has live state and `docs/handoff.md` in context. If you don't see that output, run `npm run orient` yourself before starting.
- Prefer short sessions. When a task is finished or the session gets long, update `docs/handoff.md` and tell Matt it's safe to start a fresh chat. Nothing important should live only in the conversation.
- In cloud sessions (claude.ai/code): the clone is shallow and has no `.env`, `BMO_CONTEXT.md`, or `gh` CLI. Use the GitHub MCP tools for GitHub, and hand Matt the exact local command for anything needing secrets.
- The PreToolUse hook scrubs metadata from staged PDFs on `git commit` (`scripts/scrub-pdf-metadata.sh`); CI (`pdf-privacy-check.yml`) enforces it too.
