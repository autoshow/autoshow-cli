# Language Model (LLM) Options

This project supports multiple LLM service providers, each with various models. Below is a guide to using each service/model, including skipping LLM processing and third-party APIs.

## Outline

- [Environment Variables](#environment-variables)
- [Run Only LLM Step](#run-only-llm-step)
- [Get LLM Cost](#get-llm-cost)
- [Skip LLM Processing](#skip-llm-processing)
- [OpenAI ChatGPT](#openai-chatgpt)
- [Anthropic Claude](#anthropic-claude)
- [Google Gemini](#google-gemini)

## Environment Variables

Create a `.env` file (or set them in your environment) for any service(s) you plan to use:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

## Get LLM Cost

If you just want to calculate the estimated cost of input/output tokens for a given provider:

```bash
npm run as -- --llmCost "input/examples/audio-prompt.md" --chatgpt
npm run as -- --llmCost "input/examples/audio-prompt.md" --claude
npm run as -- --llmCost "input/examples/audio-prompt.md" --gemini
```

No LLM model will be called, and no LLM-based output file is generated.

## OpenAI ChatGPT

If you have set your `OPENAI_API_KEY`:

```bash
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt
```

1. **GPT 5** (`gpt-5`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-5
   ```
2. **GPT 5 Mini** (`gpt-5-mini`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-5-mini
   ```
3. **GPT 5 Nano** (`gpt-5-nano`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-5-nano
   ```
4. **GPT 4.1 Nano** (`gpt-4.1-nano`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-4.1-nano
   ```
5. **GPT 4.1** (`gpt-4.1`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-4.1
   ```
6. **GPT 4.1 Mini** (`gpt-4.1-mini`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-4.1-mini
   ```

## Anthropic Claude

If you have set your `ANTHROPIC_API_KEY`:

```bash
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --claude
```

1. **Claude Sonnet 3.7** (`claude-3-7-sonnet-20250219`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-3-7-sonnet-20250219
   ```
2. **Claude Opus 4** (`claude-opus-4-20250514`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-opus-4-20250514
   ```
3. **Claude Sonnet 4** (`claude-sonnet-4-20250514`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-sonnet-4-20250514
   ```
4. **Claude Opus 4.1** (`claude-opus-4-1-20250805`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-opus-4-1-20250805
   ```

## Google Gemini

If you have set your `GEMINI_API_KEY`:

```bash
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini
```

1. **Gemini 2.5 Pro** (`gemini-2.5-pro`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini gemini-2.5-pro
   ```
2. **Gemini 2.5 Flash** (`gemini-2.5-flash`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini gemini-2.5-flash
   ```
3. **Gemini 2.5 Flash Lite Preview** (`gemini-2.5-flash-lite-preview-06-17`)
   ```bash
   npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini gemini-2.5-flash-lite-preview-06-17
   ```