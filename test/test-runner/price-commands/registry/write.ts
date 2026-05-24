import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const writeRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/openai-gpt-5.4.test.ts', [
    command('write-openai-gpt-5.4', 'write-openai-gpt-5.4', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'openai=gpt-5.4', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/openai-gpt-5.4-pro.test.ts', [
    command('write-openai-gpt-5.4-pro', 'write-openai-gpt-5.4-pro', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'openai=gpt-5.4-pro', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/openai-gpt-5.4-mini.test.ts', [
    command('write-openai-gpt-5.4-mini', 'write-openai-gpt-5.4-mini', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'openai=gpt-5.4-mini', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/openai-gpt-5.4-nano.test.ts', [
    command('write-openai-gpt-5.4-nano', 'write-openai-gpt-5.4-nano', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'openai=gpt-5.4-nano', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/anthropic-claude-opus-4-7.test.ts', [
    command('write-anthropic-claude-opus-4-7', 'write-anthropic-claude-opus-4-7', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'anthropic=claude-opus-4-7', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/anthropic-claude-sonnet-4-6.test.ts', [
    command('write-anthropic-claude-sonnet-4-6', 'write-anthropic-claude-sonnet-4-6', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'anthropic=claude-sonnet-4-6', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/anthropic-claude-haiku-4-5.test.ts', [
    command('write-anthropic-claude-haiku-4-5', 'write-anthropic-claude-haiku-4-5', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'anthropic=claude-haiku-4-5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/gemini-3.1-pro-preview.test.ts', [
    command('write-gemini-gemini-3.1-pro-preview', 'write-gemini-gemini-3.1-pro-preview', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'gemini=gemini-3.1-pro-preview', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/gemini-3.1-flash-lite-preview.test.ts', [
    command('write-gemini-gemini-3.1-flash-lite-preview', 'write-gemini-gemini-3.1-flash-lite-preview', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'gemini=gemini-3.1-flash-lite-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/groq-openai-gpt-oss-20b.test.ts', [
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'groq=openai/gpt-oss-20b', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/groq-openai-gpt-oss-120b.test.ts', [
    command('write-groq-openai/gpt-oss-120b', 'write-groq-openai/gpt-oss-120b', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'groq=openai/gpt-oss-120b', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/minimax-m2.7.test.ts', [
    command('write-minimax-MiniMax-M2.7', 'write-minimax-MiniMax-M2.7', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'minimax=MiniMax-M2.7', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/minimax-m2.7-highspeed.test.ts', [
    command('write-minimax-MiniMax-M2.7-highspeed', 'write-minimax-MiniMax-M2.7-highspeed', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'minimax=MiniMax-M2.7-highspeed', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/grok-4.20-reasoning.test.ts', [
    command('write-grok-grok-4.20-reasoning', 'write-grok-grok-4.20-reasoning', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'grok=grok-4.20-reasoning', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/grok-4.20-non-reasoning.test.ts', [
    command('write-grok-grok-4.20-non-reasoning', 'write-grok-grok-4.20-non-reasoning', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'grok=grok-4.20-non-reasoning', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/glm-5.1.test.ts', [
    command('write-glm-glm-5.1', 'write-glm-glm-5.1', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'glm=glm-5.1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-3-write-e2e/write-services/kimi-k2.6.test.ts', [
    command('write-kimi-kimi-k2.6', 'write-kimi-kimi-k2.6', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'kimi=kimi-k2.6', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-local.test.ts', [
    command('write-llama-qwen3-0.6b', 'write-llama-qwen3-0.6b', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'llama=ggml-org/Qwen3-0.6B-GGUF', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-3-write-e2e/write-local/write-project-lyrics.test.ts', [
    command('write-project-lyrics-single-default-llama', 'write-project-lyrics-single-default-llama', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--prompt', 'folkSong', '--price']),
    command('write-project-lyrics-directory-default-llama', 'write-project-lyrics-directory-default-llama', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts', [
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'groq=openai/gpt-oss-20b', '--prompt', 'shortSummary', '--price']),
    command('write-openai-gpt-5.4', 'write-openai-gpt-5.4', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'openai=gpt-5.4', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-2-pipeline.test.ts', [
    command('write-llama-gemma-3-270m', 'write-llama-gemma-3-270m', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'llama=ggml-org/gemma-3-270m-it-GGUF', '--price']),
  ]),
]
