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
npm run as -- --llmCost "content/examples/audio-prompt.md" --chatgpt
npm run as -- --llmCost "content/examples/audio-prompt.md" --claude
npm run as -- --llmCost "content/examples/audio-prompt.md" --gemini
```

No LLM model will be called, and no LLM-based output file is generated.

## OpenAI ChatGPT

If you have set your `OPENAI_API_KEY`:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --chatgpt
```

1. **GPT 4o** (`gpt-4o`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --chatgpt gpt-4o
   ```
2. **GPT 4o MINI** (`gpt-4o-mini`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --chatgpt gpt-4o-mini
   ```
3. **GPT o1** (`o1`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --chatgpt o1
   ```
4. **GPT o3 MINI** (`o3-mini`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --chatgpt o3-mini
   ```
5. **GPT o1 MINI** (`o1-mini`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --chatgpt o1-mini
   ```

## Anthropic Claude

If you have set your `ANTHROPIC_API_KEY`:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --claude
```

1. **Claude 3.7 Sonnet** (`claude-3-7-sonnet-latest`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --claude claude-3-7-sonnet-latest
   ```
2. **Claude 3.5 Haiku** (`claude-3-5-haiku-latest`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --claude claude-3-5-haiku-latest
   ```

## Google Gemini

If you have set your `GEMINI_API_KEY`:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --gemini
```

1. **Gemini 1.5 Pro** (`gemini-1.5-pro`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --gemini gemini-1.5-pro
   ```
2. **Gemini 1.5 Flash-8B** (`gemini-1.5-flash-8b`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --gemini gemini-1.5-flash-8b
   ```
3. **Gemini 1.5 Flash** (`gemini-1.5-flash`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --gemini gemini-1.5-flash
   ```
4. **Gemini 2.0 Flash-Lite** (`gemini-2.0-flash-lite`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --gemini gemini-2.0-flash-lite
   ```
5. **Gemini 2.0 Flash** (`gemini-2.0-flash`)
   ```bash
   npm run as -- text --video "https://www.youtube.com/watch?v=abc123" --gemini gemini-2.0-flash
   ```
