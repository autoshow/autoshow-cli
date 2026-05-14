import type { PriceSelectionEntry } from '~/types'
import { matchPathFilters } from '../../path-selection'
import { downloadRegistry } from './download'
import { imageRegistry } from './image'
import { musicRegistry } from './music'
import { ocrRegistry } from './ocr'
import { sttRegistry } from './stt'
import { ttsRegistry } from './tts'
import { videoRegistry } from './video'
import { writeRegistry } from './write'

export const BUDGET_PRICE_SELECTION_REGISTRY: PriceSelectionEntry[] = [
  ...downloadRegistry,
  ...sttRegistry,
  ...writeRegistry,
  ...ttsRegistry,
  ...imageRegistry,
  ...videoRegistry,
  ...musicRegistry,
  ...ocrRegistry,
]

export const BUDGET_TO_PRICE_SUITE_SELECTORS: Record<string, string> = {
  'test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts': 'test/test-price/step-1-download/direct-url',
  'test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts': 'test/test-price/step-1-download/streaming',
  'test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts': 'test/test-price/step-1-download/feed-or-channel',

  'test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-default.test.ts': 'test/test-price/step-2-stt/local/whisper',
  'test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-large-v3-turbo.test.ts': 'test/test-price/step-2-stt/local/whisper',
  'test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/': 'test/test-price/step-2-stt/local/reverb',
  'test/test-cases/e2e/step-2-stt-e2e/stt-services/aws/aws.test.ts': 'test/test-price/step-2-stt/services/aws',
  'test/test-cases/e2e/step-2-stt-e2e/stt-services/gcloud/gcloud.test.ts': 'test/test-price/step-2-stt/services/gcloud',
  'test/test-cases/e2e/step-2-stt-e2e/stt-services/service-models.test.ts': 'test/test-price/step-2-stt/services',
  'test/test-cases/e2e/cli-integration.test.ts': 'test/test-price/integration/cli',
  'test/test-cases/e2e/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts': 'test/test-price/step-7-music-lyrics-video',

  'test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts': 'test/test-price/step-3-write/services',
  'test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts': 'test/test-price/step-3-write/local/subcommand',
  'test/test-cases/e2e/step-3-write-e2e/write-local/write-project-lyrics.test.ts': 'test/test-price/step-3-write/local/project-lyrics',
  'test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts': 'test/test-price/step-4-tts/pipeline',
  'test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts': 'test/test-price/step-5-image/openai',

  'test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts': 'test/test-price/step-4-tts/services',
  'test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts': 'test/test-price/step-4-tts/local/kitten',

  'test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts': 'test/test-price/step-5-image/gemini',
  'test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts': 'test/test-price/step-5-image/minimax',
  'test/test-cases/e2e/step-5-image-gen-e2e/glm-image-gen.test.ts': 'test/test-price/step-5-image/glm',
  'test/test-cases/e2e/step-5-image-gen-e2e/grok-image-gen.test.ts': 'test/test-price/step-5-image/grok',
  'test/test-cases/e2e/step-5-image-gen-e2e/runway-image-gen.test.ts': 'test/test-price/step-5-image/runway',
  'test/test-cases/e2e/step-5-image-gen-e2e/bfl-image-gen.test.ts': 'test/test-price/step-5-image/bfl',
  'test/test-cases/e2e/step-5-image-gen-e2e/deapi-image-gen.test.ts': 'test/test-price/step-5-image/deapi',

  'test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts': 'test/test-price/step-6-video',

  'test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts': 'test/test-price/step-7-music/elevenlabs',
  'test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts': 'test/test-price/step-7-music/minimax',
  'test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts': 'test/test-price/step-7-music/gemini',

  'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts': 'test/test-price/step-2-ocr/services',
  'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts': 'test/test-price/step-2-ocr/services/firecrawl',
  'test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts': 'test/test-price/step-2-ocr/local/paddle-ocr-image',
}

const toPriceSuiteEntry = (entry: PriceSelectionEntry): PriceSelectionEntry => ({
  ...entry,
  selector: BUDGET_TO_PRICE_SUITE_SELECTORS[entry.selector] ?? entry.selector,
})

export const PRICE_SELECTION_REGISTRY: PriceSelectionEntry[] =
  BUDGET_PRICE_SELECTION_REGISTRY.map(toPriceSuiteEntry)

export const resolvePriceSuiteSelectorsForE2eSelector = (pathFilter: string): string[] => {
  const selectors = new Set<string>()
  for (const [budgetSelector, priceSuiteSelector] of Object.entries(BUDGET_TO_PRICE_SUITE_SELECTORS)) {
    if (matchPathFilters(budgetSelector, [pathFilter])) {
      selectors.add(priceSuiteSelector)
    }
  }
  return [...selectors].sort()
}
