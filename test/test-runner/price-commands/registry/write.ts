import type { PriceSelectionEntry } from '../../../../src/types/tests-dir-types'
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
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-models.test.ts', [
    command('write-llama-gemma-3-270m', 'write-llama-gemma-3-270m', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts', [
    command('write-llama-qwen3-0.6b', 'write-llama-qwen3-0.6b', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
    command('write-llama-qwen3-0.6b-document', 'write-llama-qwen3-0.6b-document', ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
  ]),
]
