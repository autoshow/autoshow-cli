import {
  buildApiCheapPriceCommands,
  dedupePriceCommands,
  type ApiCheapPriceCommand
} from '../test-utils/api-cheap-config'
import { getModelRegistry } from '../../src/cli/commands/models/model-loader'
import type { Tier } from '../../src/types/tests-dir-types'

const buildApiPriceCommands = (): ApiCheapPriceCommand[] => {
  const registry = getModelRegistry()
  const llmCommands: ApiCheapPriceCommand[] = []
  for (const [service, config] of Object.entries(registry.llm)) {
    if (config.type !== 'api') continue
    const flag = `--${service}`
    for (const model of Object.keys(config.models)) {
      llmCommands.push({
        name: `write-${service}-${model}`,
        args: ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', flag, model, '--price']
      })
    }
  }

  const sttCommands: ApiCheapPriceCommand[] = []
  for (const [service, config] of Object.entries(registry.stt)) {
    if (config.type !== 'api') continue
    const flag = `--${service}-stt`
    for (const model of Object.keys(config.models)) {
      sttCommands.push({
        name: `transcribe-${service}-${model}`,
        args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', flag, model, '--price']
      })
    }
  }

  const commands: ApiCheapPriceCommand[] = [
    ...buildApiCheapPriceCommands(),
    ...llmCommands,
    ...sttCommands,

    { name: 'transcribe-url-audio', args: ['src/cli/create-cli.ts', 'transcribe', 'https://ajc.pics/autoshow/1-audio.mp3', '--whisper', 'tiny', '--price'] },
    { name: 'transcribe-url-video', args: ['src/cli/create-cli.ts', 'transcribe', 'https://ajc.pics/autoshow/2-video.mp4', '--whisper', 'tiny', '--price'] },
    { name: 'transcribe-youtube-single', args: ['src/cli/create-cli.ts', 'transcribe', 'https://www.youtube.com/watch?v=u1-WHqATSQU', '--whisper', 'tiny', '--price'] },
    { name: 'transcribe-rss-batch-1', args: ['src/cli/create-cli.ts', 'transcribe', 'https://ajcwebdev.substack.com/feed', '--batch-limit', '1', '--whisper', 'tiny', '--price'] },
    { name: 'transcribe-youtube-channel-batch-1', args: ['src/cli/create-cli.ts', 'transcribe', 'https://www.youtube.com/@fireship', '--batch-limit', '1', '--whisper', 'tiny', '--price'] },

    { name: 'tts-elevenlabs-eleven-v3', args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--elevenlabs-tts', 'eleven_v3', '--price'] },
    { name: 'tts-openai-gpt-4o-mini-tts', args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--price'] },
    { name: 'tts-gemini-2.5-flash-preview-tts', args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--gemini-tts', 'gemini-2.5-flash-preview-tts', '--price'] },

    { name: 'image-openai-gpt-image-1', args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1', '--price'] },
    { name: 'image-openai-gpt-image-1-mini-jpeg', args: ['src/cli/create-cli.ts', 'image', 'a simple blue square on white background', '--openai-image', 'gpt-image-1-mini', '--image-format', 'jpeg', '--image-size', '1024x1024', '--image-quality', 'low', '--price'] },
    { name: 'image-gemini-gemini-3-pro-image-preview', args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'gemini-3-pro-image-preview', '--price'] },
    { name: 'image-gemini-imagen-4-count-4', args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-generate-001', '--imagen-count', '4', '--price'] },
    { name: 'image-minimax-image-01', args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--minimax-image', 'image-01', '--price'] },

    { name: 'music-elevenlabs-music-v1', args: ['src/cli/create-cli.ts', 'music', 'a cinematic theme', '--elevenlabs-music', 'music_v1', '--price'] },
    { name: 'music-minimax-music-2-5', args: ['src/cli/create-cli.ts', 'music', 'a cinematic theme', '--minimax-music', 'music-2.5', '--price'] },

    { name: 'video-sora-sora-2', args: ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--sora-video', 'sora-2', '--price'] },
    { name: 'video-minimax-hailuo-2-3-10s', args: ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-2.3', '--video-duration', '10', '--price'] },
    { name: 'video-gemini-veo-fast-pipeline', args: ['src/cli/create-cli.ts', 'write', 'any-input', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price'] },
    { name: 'video-minimax-hailuo-pipeline', args: ['src/cli/create-cli.ts', 'write', 'any-input', '--minimax-video', 'MiniMax-Hailuo-2.3', '--video-duration', '10', '--price'] },

    { name: 'tts-elevenlabs-pipeline', args: ['src/cli/create-cli.ts', 'write', 'any-input', '--elevenlabs-tts', 'eleven_flash_v2_5', '--price'] },
    { name: 'tts-openai-pipeline', args: ['src/cli/create-cli.ts', 'write', 'any-input', '--openai-tts', 'gpt-4o-mini-tts', '--price'] },
    { name: 'tts-gemini-pipeline', args: ['src/cli/create-cli.ts', 'write', 'any-input', '--gemini-tts', 'gemini-2.5-flash-preview-tts', '--price'] },
    { name: 'tts-kitten-price', args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price'] },

    { name: 'extract-mistral-ocr-latest', args: ['src/cli/create-cli.ts', 'extract', 'input/1-document.pdf', '--mistral-ocr', 'mistral-ocr-latest', '--price'] },
    { name: 'extract-mistral-ocr-2512', args: ['src/cli/create-cli.ts', 'extract', 'input/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2512', '--price'] },
  ]

  return dedupePriceCommands(commands)
}

const buildSmokePriceCommands = (): ApiCheapPriceCommand[] => {
  return dedupePriceCommands([
    { name: 'smoke-transcribe-whisper-tiny', args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', '--whisper', 'tiny', '--price'] },
    { name: 'smoke-write-llama-270m', args: ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--price'] },
    { name: 'smoke-tts-kitten', args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price'] },
    { name: 'smoke-image-gemini', args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-fast-generate-001', '--price'] },
    { name: 'smoke-music-minimax', args: ['src/cli/create-cli.ts', 'music', 'a short upbeat theme', '--minimax-music', 'music-2.5', '--price'] },
  ])
}

const buildLocalPriceCommands = (): ApiCheapPriceCommand[] => {
  return dedupePriceCommands([
    { name: 'local-transcribe-whisper-base', args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', '--whisper', 'base', '--price'] },
    { name: 'local-transcribe-whisper-large-v3-turbo', args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price'] },
    { name: 'local-transcribe-whisper-split', args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', '--split', '--whisper', 'tiny', '--price'] },
    { name: 'local-write-llama-270m', args: ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--price'] },
    { name: 'local-tts-kitten', args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price'] },
    { name: 'local-image-gemini-fast', args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-fast-generate-001', '--price'] },
  ])
}

const buildSlowLocalPriceCommands = (): ApiCheapPriceCommand[] => {
  return dedupePriceCommands([
    { name: 'slow-local-transcribe-reverb', args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', '--reverb', '--reverb-verbatimicity', '0.5', '--price'] },
    { name: 'slow-local-transcribe-whisper-large-v3-turbo', args: ['src/cli/create-cli.ts', 'transcribe', 'input/1-audio.mp3', '--whisper', 'large-v3-turbo', '--price'] },
  ])
}

const buildSlowApiPriceCommands = (): ApiCheapPriceCommand[] => {
  return dedupePriceCommands([
    { name: 'slow-api-transcribe-twitch', args: ['src/cli/create-cli.ts', 'transcribe', 'https://www.twitch.tv/fails', '--whisper', 'tiny', '--price'] },
    { name: 'slow-api-transcribe-input-2-urls', args: ['src/cli/create-cli.ts', 'transcribe', 'input/2-urls.md', '--whisper', 'tiny', '--price'] },
    { name: 'slow-api-docs-image-minimax-price', args: ['src/cli/create-cli.ts', 'image', 'a sunset over mountains', '--minimax-image', 'image-01', '--price'] },
    { name: 'slow-api-docs-video-minimax-price', args: ['src/cli/create-cli.ts', 'video', 'a sunset timelapse', '--minimax-video', 'MiniMax-Hailuo-2.3', '--video-duration', '10', '--price'] },
    { name: 'slow-api-docs-write-minimax-video-price', args: ['src/cli/create-cli.ts', 'write', 'input/1-audio.mp3', '--minimax-video', 'MiniMax-Hailuo-2.3', '--video-duration', '10', '--price'] },
  ])
}

export const buildTierPriceCommands = (tier: Tier): ApiCheapPriceCommand[] => {
  if (tier === 'smoke') return buildSmokePriceCommands()
  if (tier === 'local') return buildLocalPriceCommands()
  if (tier === 'api') return buildApiPriceCommands()
  if (tier === 'slow-local') return buildSlowLocalPriceCommands()
  return buildSlowApiPriceCommands()
}
