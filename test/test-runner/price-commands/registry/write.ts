import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const writeRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts', [
    command('write-openai-gpt-5.4', 'write-openai-gpt-5.4', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4', '--price']),
    command('write-openai-gpt-5.4-pro', 'write-openai-gpt-5.4-pro', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4-pro', '--price']),
    command('write-openai-gpt-5.4-mini', 'write-openai-gpt-5.4-mini', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4-mini', '--price']),
    command('write-openai-gpt-5.4-nano', 'write-openai-gpt-5.4-nano', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4-nano', '--price']),
    command('write-anthropic-claude-opus-4-7', 'write-anthropic-claude-opus-4-7', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--anthropic', 'claude-opus-4-7', '--price']),
    command('write-anthropic-claude-opus-4-6', 'write-anthropic-claude-opus-4-6', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--anthropic', 'claude-opus-4-6', '--price']),
    command('write-anthropic-claude-sonnet-4-6', 'write-anthropic-claude-sonnet-4-6', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--anthropic', 'claude-sonnet-4-6', '--price']),
    command('write-anthropic-claude-haiku-4-5', 'write-anthropic-claude-haiku-4-5', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--anthropic', 'claude-haiku-4-5', '--price']),
    command('write-gemini-gemini-3.1-pro-preview', 'write-gemini-gemini-3.1-pro-preview', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--gemini', 'gemini-3.1-pro-preview', '--price']),
    command('write-gemini-gemini-3.1-flash-lite-preview', 'write-gemini-gemini-3.1-flash-lite-preview', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--gemini', 'gemini-3.1-flash-lite-preview', '--price']),
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--groq', 'openai/gpt-oss-20b', '--price']),
    command('write-groq-openai/gpt-oss-120b', 'write-groq-openai/gpt-oss-120b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--groq', 'openai/gpt-oss-120b', '--price']),
    command('write-minimax-MiniMax-M2.5', 'write-minimax-MiniMax-M2.5', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax', 'MiniMax-M2.5', '--price']),
    command('write-minimax-MiniMax-M2.5-highspeed', 'write-minimax-MiniMax-M2.5-highspeed', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax', 'MiniMax-M2.5-highspeed', '--price']),
    command('write-grok-grok-4.20-reasoning', 'write-grok-grok-4.20-reasoning', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--grok', 'grok-4.20-reasoning', '--price']),
    command('write-grok-grok-4.20-non-reasoning', 'write-grok-grok-4.20-non-reasoning', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--grok', 'grok-4.20-non-reasoning', '--price']),
    command('write-glm-glm-5.1', 'write-glm-glm-5.1', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--glm', 'glm-5.1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-models.test.ts', [
    command('write-llama-gemma-3-270m', 'write-llama-gemma-3-270m', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--price']),
    command('write-llama-qwen3-0.6b', 'write-llama-qwen3-0.6b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts', [
    command('write-llama-qwen3-0.6b', 'write-llama-qwen3-0.6b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
    command('write-llama-qwen3-0.6b-document', 'write-llama-qwen3-0.6b-document', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
    command('write-llama-qwen3-0.6b-epub', 'write-llama-qwen3-0.6b-epub', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-epub.epub', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--chapters', '--length', '5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/write-project-lyrics.test.ts', [
    command('write-project-lyrics-single-default-llama', 'write-project-lyrics-single-default-llama', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--prompt', 'folkSong', '--price']),
    command('write-project-lyrics-directory-default-llama', 'write-project-lyrics-directory-default-llama', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--prompt', 'shortSummary', '--price']),
    command('write-project-lyrics-price', 'write-project-lyrics-price', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--price']),
  ]),
  ...exact('test/test-cases/e2e/cli-integration.test.ts', [
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--groq', 'openai/gpt-oss-20b', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts', [
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--groq', 'openai/gpt-oss-20b', '--price']),
    command('write-openai-gpt-5.4', 'write-openai-gpt-5.4', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts', [
    command('write-llama-gemma-3-270m', 'write-llama-gemma-3-270m', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--price']),
  ]),
]
