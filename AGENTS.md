# Agent Verification Rules

- Use `bun run check` for the default verification pass.
- For smoke coverage, run only targeted local/no-cost tests that do not call third-party APIs, such as:
  - `bun test test/test-cases/validation/cli-help-contracts.test.ts`
  - `bun test test/test-cases/validation/cli-usage-errors.test.ts`
  - `bun test test/test-cases/validation/option-resolution-contracts.test.ts`
  - `bun test test/test-cases/smoke/sample/sample-command.test.ts`
- Never run `bun run t` or `AGENT=1 bun test/test-runner.ts` unless the user explicitly asks for the full suite.
- Never run smoke or e2e tests that can make third-party API calls with any cost, billing, quota, or price association.
- If a test might reach OpenAI, Anthropic, Gemini, Mistral, AWS, Google Cloud, ElevenLabs, MiniMax, deAPI, Deepgram, Groq, Grok, Firecrawl, or any other paid provider, do not run it without explicit user approval.
