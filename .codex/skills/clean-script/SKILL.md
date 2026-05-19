---
name: clean-script
description: Normalize AutoShow episode script Markdown without changing story content. Use when Codex needs to clean, format, or validate AutoShow script files, especially Markdown under input/episode-scripts/**, by enforcing the project script shell, speaker/delivery spacing, parenthetical formatting, line whitespace, and final-newline rules.
---

# Clean Script

## Workflow

1. Read `references/script-formatting-rules.md` before editing script Markdown.
2. Treat the task as formatting-only. Do not copyedit, rewrite jokes, change punctuation for style, or alter story meaning.
3. Prefer the deterministic formatter:
   - Write fixes: `bun .codex/skills/clean-script/scripts/clean_script.ts --write <paths...>`
   - Check only: `bun .codex/skills/clean-script/scripts/clean_script.ts --check <paths...>`
4. Review any reported shell issues manually. The formatter reports missing or ambiguous episode shell fields instead of inventing titles, locations, or scene headings.
5. If manual cleanup is still needed, keep edits limited to the rules in the reference file.

## Scope

- Use this skill for AutoShow episode script Markdown, especially under `input/episode-scripts/**`.
- Preserve outline tables and script structure.
- Preserve content intent, wording, jokes, dialogue, and story beats unless the user explicitly asks for rewriting.
