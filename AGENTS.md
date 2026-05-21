# Agent Verification Rules

- Use `bun run check` for the default verification pass.
- For smoke coverage, run only targeted local/no-cost tests that do not call third-party APIs, such as:
  - `bun test test/test-cases/validation/cli-help-contracts.test.ts`
  - `bun test test/test-cases/validation/cli-usage-errors.test.ts`
  - `bun test test/test-cases/validation/option-resolution-contracts.test.ts`
- Never run `bun run t` or `AGENT=1 bun test/test-runner.ts` unless the user explicitly asks for the full suite.
- Never run smoke or e2e tests that can make third-party API calls with any cost, billing, quota, or price association.

# Paid Provider Execution Rules

- Never run CLI commands that can call paid or quota-limited third-party providers unless the user explicitly approves that exact paid run immediately beforehand.
- Treat commands such as `bun as extract ... --openai`, `--gemini`, `--mistral`, `--deepinfra`, hosted STT/TTS/image/video/music generation, or any command with provider API flags as paid-provider runs, not verification.
- For provider failure debugging, run only local/no-cost preparation and validation steps, such as PDF repair, file inspection, manifest inspection, and local chunk/render smoke checks. Then report the exact provider command for the user to run themselves.
- Do not interpret a generic instruction like “do it”, “try it”, or “rerun it” as approval to spend provider credits. Ask for explicit approval naming the provider command and expected cost/risk instead.
- If a paid-provider process is accidentally started, stop it promptly and report what was run.
