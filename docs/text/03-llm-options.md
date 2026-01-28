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
bun as -- --llmCost "input/audio-prompt.md" --chatgpt
bun as -- --llmCost "input/audio-prompt.md" --claude
bun as -- --llmCost "input/audio-prompt.md" --gemini
```

No LLM model will be called, and no LLM-based output file is generated.

## OpenAI ChatGPT

If you have set your `OPENAI_API_KEY`:

```bash
bun as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt
```

1. **GPT 5.2** (`gpt-5.2`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-5.2
   ```
2. **GPT 5.2 Pro** (`gpt-5.2-pro`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-5.2-pro
   ```
3. **GPT 5.1** (`gpt-5.1`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --chatgpt gpt-5.1
   ```

## Anthropic Claude

If you have set your `ANTHROPIC_API_KEY`:

```bash
bun as -- text --rss "https://ajcwebdev.substack.com/feed" --claude
```

1. **Claude Opus 4.5** (`claude-opus-4-5-20251101`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-opus-4-5-20251101
   ```
2. **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-sonnet-4-5-20250929
   ```
3. **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --claude claude-haiku-4-5-20251001
   ```

## Google Gemini

If you have set your `GEMINI_API_KEY`:

```bash
bun as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini
```

1. **Gemini 3 Pro** (`gemini-3-pro-preview`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini gemini-3-pro-preview
   ```
2. **Gemini 3 Flash** (`gemini-3-flash-preview`)
   ```bash
   bun as -- text --rss "https://ajcwebdev.substack.com/feed" --gemini gemini-3-flash-preview
   ```