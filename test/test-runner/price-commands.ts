import { buildApiCheapPriceCommands } from '../test-utils/api-cheap-config'
import type { PriceCommandSpec, PriceSelectionEntry } from '../../src/types/tests-dir-types'
import { formatSelectedPathsLabel, resolveSelectedFiles } from './path-selection'

const exact = (selector: string, entries: PriceCommandSpec[]): PriceSelectionEntry[] => {
  return entries.map(entry => ({
    ...entry,
    selector,
    selectorKind: 'file',
  }))
}

const prefix = (selector: string, entries: PriceCommandSpec[]): PriceSelectionEntry[] => {
  return entries.map(entry => ({
    ...entry,
    selector,
    selectorKind: 'prefix',
  }))
}

const command = (
  name: string,
  key: string,
  args: string[],
  budgetSkippable = true
): PriceCommandSpec => ({ name, key, args, budgetSkippable })

const reportOnly = (name: string, args: string[]): PriceCommandSpec => {
  return command(name, name, args, false)
}

const selectorMatchesFile = (entry: PriceSelectionEntry, file: string): boolean => {
  if (entry.selectorKind === 'file') {
    return file === entry.selector
  }

  const normalizedPrefix = entry.selector.endsWith('/') ? entry.selector : `${entry.selector}/`
  return file.startsWith(normalizedPrefix)
}

const dedupeResolvedCommands = (entries: PriceSelectionEntry[]): PriceCommandSpec[] => {
  const deduped = new Map<string, PriceCommandSpec>()

  for (const entry of entries) {
    const argsKey = entry.args.join('\u001f')
    const existing = deduped.get(argsKey)
    if (!existing) {
      deduped.set(argsKey, {
        name: entry.name,
        key: entry.key,
        args: entry.args,
        budgetSkippable: entry.budgetSkippable,
      })
      continue
    }

    if (existing.key !== entry.key || existing.name !== entry.name) {
      throw new Error(`Conflicting price registry entries for identical command args: ${entry.args.join(' ')}`)
    }

    if (!existing.budgetSkippable && entry.budgetSkippable) {
      deduped.set(argsKey, {
        name: entry.name,
        key: entry.key,
        args: entry.args,
        budgetSkippable: true,
      })
    }
  }

  return [...deduped.values()]
}

export const PRICE_SELECTION_REGISTRY: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/api-cheap.test.ts', buildApiCheapPriceCommands().map(entry => ({
    ...entry,
    key: entry.name,
    budgetSkippable: false,
  }))),

  ...exact('test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts', [
    reportOnly('transcribe-url-audio', ['src/cli/create-cli.ts', 'stt', 'https://ajc.pics/autoshow/1-audio.mp3', '--whisper', 'tiny', '--price']),
    reportOnly('transcribe-url-video', ['src/cli/create-cli.ts', 'stt', 'https://ajc.pics/autoshow/2-video.mp4', '--whisper', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts', [
    reportOnly('transcribe-youtube-single', ['src/cli/create-cli.ts', 'stt', 'https://www.youtube.com/watch?v=u1-WHqATSQU', '--whisper', 'tiny', '--price']),
    reportOnly('transcribe-twitch', ['src/cli/create-cli.ts', 'stt', 'https://www.twitch.tv/videos/1844440442', '--whisper', 'tiny', '--price']),
    reportOnly('transcribe-streaming-url-list-batch-1', ['src/cli/create-cli.ts', 'stt', 'input/2-urls.md', '--batch-limit', '1', '--whisper', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts', [
    reportOnly('transcribe-rss-batch-1', ['src/cli/create-cli.ts', 'stt', 'https://ajcwebdev.substack.com/feed', '--batch-limit', '1', '--whisper', 'tiny', '--price']),
    reportOnly('transcribe-youtube-channel-batch-1', ['src/cli/create-cli.ts', 'stt', 'https://www.youtube.com/@fireship', '--batch-limit', '1', '--whisper', 'tiny', '--price']),
  ]),

  ...exact('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-default.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'base', '--price']),
    command('transcribe-whisper-split', 'transcribe-whisper-split', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--split', '--whisper', 'tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-models-price.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'base', '--price']),
    command('transcribe-whisper-small', 'transcribe-whisper-small', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'small', '--price']),
    command('transcribe-whisper-medium', 'transcribe-whisper-medium', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'medium', '--price']),
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-large-v3-turbo.test.ts', [
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price']),
    command('transcribe-whisper-large-v3-turbo-split', 'transcribe-whisper-large-v3-turbo-split', ['src/cli/create-cli.ts', 'stt', 'input/2-video.mp4', '--whisper', 'large-v3-turbo', '--split', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/reverb/', [
    command('transcribe-reverb', 'transcribe-reverb', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--reverb', '--reverb-verbatimicity', '0.5', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/assemblyai/', [
    command('transcribe-assemblyai-universal-2', 'transcribe-assemblyai-universal-2', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--assemblyai-stt', 'universal-2', '--price']),
    command('transcribe-assemblyai-universal-3-pro', 'transcribe-assemblyai-universal-3-pro', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--assemblyai-stt', 'universal-3-pro', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/elevenlabs/', [
    command('transcribe-elevenlabs-scribe_v2', 'transcribe-elevenlabs-scribe_v2', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--elevenlabs-stt', 'scribe_v2', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/groq/', [
    command('transcribe-groq-whisper-large-v3', 'transcribe-groq-whisper-large-v3', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--groq-stt', 'whisper-large-v3', '--price']),
    command('transcribe-groq-whisper-large-v3-turbo', 'transcribe-groq-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--groq-stt', 'whisper-large-v3-turbo', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/openai/', [
    command('transcribe-openai-gpt-4o-transcribe-diarize', 'transcribe-openai-gpt-4o-transcribe-diarize', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--openai-stt', 'gpt-4o-transcribe-diarize', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/mistral/', [
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--mistral-stt', 'voxtral-mini-2602', '--price']),
    command('transcribe-mistral-voxtral-mini-latest', 'transcribe-mistral-voxtral-mini-latest', ['src/cli/create-cli.ts', 'stt', 'input/1-audio.mp3', '--mistral-stt', 'voxtral-mini-latest', '--price']),
  ]),

  ...prefix('test/test-cases/e2e/step-3-write-e2e/write-services/openai/', [
    command('write-openai-gpt-5.2', 'write-openai-gpt-5.2', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--openai', 'gpt-5.2', '--price']),
    command('write-openai-gpt-5.2-pro', 'write-openai-gpt-5.2-pro', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--openai', 'gpt-5.2-pro', '--price']),
    command('write-openai-gpt-5.1', 'write-openai-gpt-5.1', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--openai', 'gpt-5.1', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-3-write-e2e/write-services/anthropic/', [
    command('write-anthropic-claude-opus-4-6', 'write-anthropic-claude-opus-4-6', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--anthropic', 'claude-opus-4-6', '--price']),
    command('write-anthropic-claude-sonnet-4-6', 'write-anthropic-claude-sonnet-4-6', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--anthropic', 'claude-sonnet-4-6', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-3-write-e2e/write-services/gemini/', [
    command('write-gemini-gemini-3-flash-preview', 'write-gemini-gemini-3-flash-preview', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--gemini', 'gemini-3-flash-preview', '--price']),
    command('write-gemini-gemini-3-pro-preview', 'write-gemini-gemini-3-pro-preview', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--gemini', 'gemini-3-pro-preview', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-3-write-e2e/write-services/groq/', [
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--groq', 'openai/gpt-oss-20b', '--price']),
    command('write-groq-openai/gpt-oss-120b', 'write-groq-openai/gpt-oss-120b', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--groq', 'openai/gpt-oss-120b', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/step-3-write-e2e/write-services/minimax/', [
    command('write-minimax-MiniMax-M2.5', 'write-minimax-MiniMax-M2.5', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--minimax', 'MiniMax-M2.5', '--price']),
    command('write-minimax-MiniMax-M2.5-highspeed', 'write-minimax-MiniMax-M2.5-highspeed', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--minimax', 'MiniMax-M2.5-highspeed', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts', [
    command('write-openai-gpt-5.2', 'write-openai-gpt-5.2', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--openai', 'gpt-5.2', '--price']),
    command('write-anthropic-claude-sonnet-4-6', 'write-anthropic-claude-sonnet-4-6', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--anthropic', 'claude-sonnet-4-6', '--price']),
    command('write-gemini-gemini-3-flash-preview', 'write-gemini-gemini-3-flash-preview', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--gemini', 'gemini-3-flash-preview', '--price']),
    command('write-groq-openai/gpt-oss-20b', 'write-groq-openai/gpt-oss-20b', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--groq', 'openai/gpt-oss-20b', '--price']),
    command('write-minimax-MiniMax-M2.5', 'write-minimax-MiniMax-M2.5', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--minimax', 'MiniMax-M2.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-smoke.test.ts', [
    command('write-llama-gemma-3-270m', 'write-llama-gemma-3-270m', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-qwen.test.ts', [
    command('write-llama-qwen3-0.6b', 'write-llama-qwen3-0.6b', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts', [
    command('write-llama-qwen3-0.6b', 'write-llama-qwen3-0.6b', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
    command('write-llama-qwen3-0.6b-document', 'write-llama-qwen3-0.6b-document', ['src/cli/create-cli.ts', 'write', 'input/1-document.pdf', '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--price']),
  ]),

  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts', [
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts', [
    command('tts-gemini-gemini-2.5-flash-preview-tts', 'tts-gemini-gemini-2.5-flash-preview-tts', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--gemini-tts', 'gemini-2.5-flash-preview-tts', '--price']),
    command('tts-gemini-gemini-2.5-pro-preview-tts', 'tts-gemini-gemini-2.5-pro-preview-tts', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--gemini-tts', 'gemini-2.5-pro-preview-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/groq-tts.test.ts', [
    command('tts-groq-canopylabs/orpheus-v1-english', 'tts-groq-canopylabs/orpheus-v1-english', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--groq-tts', 'canopylabs/orpheus-v1-english', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts', [
    command('tts-minimax-speech-2.8-turbo', 'tts-minimax-speech-2.8-turbo', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--minimax-tts', 'speech-2.8-turbo', '--price']),
    command('tts-minimax-speech-2.8-hd', 'tts-minimax-speech-2.8-hd', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--minimax-tts', 'speech-2.8-hd', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/elevenlabs-tts.test.ts', [
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--elevenlabs-tts', 'eleven_v3', '--price']),
    command('tts-elevenlabs-eleven_flash_v2_5', 'tts-elevenlabs-eleven_flash_v2_5', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--elevenlabs-tts', 'eleven_flash_v2_5', '--price']),
    command('tts-elevenlabs-eleven_turbo_v2_5', 'tts-elevenlabs-eleven_turbo_v2_5', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--elevenlabs-tts', 'eleven_turbo_v2_5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts', [
    command('tts-kitten-micro', 'tts-kitten-micro', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-micro', '--price']),
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price']),
    command('tts-kitten-nano', 'tts-kitten-nano', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-nano', '--price']),
    command('tts-kitten-nano-0.8-int8', 'tts-kitten-nano-0.8-int8', ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-nano-0.8-int8', '--price']),
  ]),

  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts', [
    command('image-openai-gpt-image-1', 'image-openai-gpt-image-1', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1', '--price']),
    command('image-openai-gpt-image-1-mini', 'image-openai-gpt-image-1-mini', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1-mini', '--price']),
    command('image-openai-gpt-image-1.5', 'image-openai-gpt-image-1.5', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts', [
    command('image-gemini-gemini-3-pro-image-preview', 'image-gemini-gemini-3-pro-image-preview', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'gemini-3-pro-image-preview', '--price']),
    command('image-gemini-imagen-4.0-ultra-generate-001', 'image-gemini-imagen-4.0-ultra-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-ultra-generate-001', '--price']),
    command('image-gemini-imagen-4.0-fast-generate-001', 'image-gemini-imagen-4.0-fast-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-fast-generate-001', '--price']),
    command('image-gemini-imagen-4.0-generate-001', 'image-gemini-imagen-4.0-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-generate-001', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts', [
    command('image-minimax-image-01', 'image-minimax-image-01', ['src/cli/create-cli.ts', 'image', 'a sunset', '--minimax-image', 'image-01', '--price']),
  ]),

  ...exact('test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts', [
    command('video-sora-sora-2', 'video-sora-sora-2', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--sora-video', 'sora-2', '--price']),
    command('video-sora-sora-2-pro', 'video-sora-sora-2-pro', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--sora-video', 'sora-2-pro', '--price']),
    command('video-gemini-veo-3.1-fast-generate-preview', 'video-gemini-veo-3.1-fast-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price']),
    command('video-gemini-veo-3.1-generate-preview', 'video-gemini-veo-3.1-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-generate-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts', [
    command('video-minimax-MiniMax-Hailuo-2.3', 'video-minimax-MiniMax-Hailuo-2.3', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-2.3', '--price']),
    command('video-minimax-T2V-01', 'video-minimax-T2V-01', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'T2V-01', '--price']),
    command('video-minimax-MiniMax-Hailuo-02', 'video-minimax-MiniMax-Hailuo-02', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-02', '--price']),
    command('video-minimax-T2V-01-Director', 'video-minimax-T2V-01-Director', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'T2V-01-Director', '--price']),
  ]),

  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts', [
    command('music-elevenlabs-music_v1', 'music-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs-music', 'music_v1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts', [
    command('music-minimax-music-2.5', 'music-minimax-music-2.5', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--minimax-music', 'music-2.5', '--price']),
    command('music-pipeline-minimax-music-2.5', 'music-pipeline-minimax-music-2.5', ['src/cli/create-cli.ts', 'write', 'any-input', '--minimax-music', 'music-2.5', '--price']),
    command('music-pipeline-minimax-music-2.5', 'music-pipeline-minimax-music-2.5', ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--minimax-music', 'music-2.5', '--price']),
  ]),

  ...exact('test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts', [
    command('extract-mistral-mistral-ocr-latest', 'extract-mistral-mistral-ocr-latest', ['src/cli/create-cli.ts', 'ocr', 'input/1-document.pdf', '--mistral-ocr', 'mistral-ocr-latest', '--price']),
    command('extract-mistral-mistral-ocr-2512', 'extract-mistral-mistral-ocr-2512', ['src/cli/create-cli.ts', 'ocr', 'input/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2512', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-extract-e2e/extract-local/extract-paddle-ocr-image.test.ts', [
    command('extract-paddle-ocr-image', 'extract-paddle-ocr-image', ['src/cli/create-cli.ts', 'ocr', 'input/1-document.pdf', '--paddle-ocr', '--price']),
  ]),
]

export const resolvePriceSelection = (
  allFiles: string[],
  pathFilters: string[],
  budgetSkippableOnly = false
): { suiteName: string, commands: PriceCommandSpec[] } => {
  const selectedFiles = resolveSelectedFiles(allFiles, pathFilters)
  const matchingEntries = PRICE_SELECTION_REGISTRY.filter(entry => {
    return selectedFiles.some(file => selectorMatchesFile(entry, file))
  })

  const filteredEntries = budgetSkippableOnly
    ? matchingEntries.filter(entry => entry.budgetSkippable)
    : matchingEntries

  return {
    suiteName: pathFilters.length === 0 ? 'All mapped tests' : formatSelectedPathsLabel(pathFilters),
    commands: dedupeResolvedCommands(filteredEntries),
  }
}
