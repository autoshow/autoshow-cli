import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import type { StepDefinition, StepKey, TopPickBucket } from './bench-rank-types'

export const RESULTS_DIR = join(PROJECT_ROOT, 'project/reports/results')
export const RAW_BENCHMARKS_DIR = join(RESULTS_DIR, 'raw-benchmarks')
export const OUTPUT_PATH = join(PROJECT_ROOT, 'docs/benchmarks/benchmark-ranking-report.md')

export const STEP_DEFINITIONS: readonly StepDefinition[] = [
  {
    key: 'download',
    title: 'Step 1 Download',
    noQualityNote: 'No pure quality metric is available for download rows.'
  },
  {
    key: 'documentOcr',
    title: 'Step 2 Document OCR',
    noQualityNote: 'Quality uses WER-derived accuracy scores from raw OCR comparison reports.'
  },
  {
    key: 'urlExtraction',
    title: 'Step 2 URL Extraction',
    noQualityNote: 'Quality uses URL extraction accuracy scores from raw URL comparison reports.'
  },
  {
    key: 'transcription',
    title: 'Step 2 Transcription/STT',
    noQualityNote: 'Quality uses speaker-aware WER scores from raw STT reference comparison reports.'
  },
  {
    key: 'llm',
    title: 'Step 3 Write/LLM',
    noQualityNote: 'No pure LLM quality metric is present in these benchmark files.'
  },
  {
    key: 'tts',
    title: 'Step 4 TTS',
    noQualityNote: 'No TTS quality ranking is shown because roundtrip WER is null in the current raw TTS comparison and dashboard rows do not contain a pure TTS quality metric.'
  },
  {
    key: 'image',
    title: 'Step 5 Image',
    noQualityNote: 'No pure image quality metric is present in these benchmark files.'
  },
  {
    key: 'video',
    title: 'Step 6 Video',
    noQualityNote: 'No pure video quality metric is present in these benchmark files.'
  },
  {
    key: 'music',
    title: 'Step 7 Music',
    noQualityNote: 'No pure music quality metric is present in these benchmark files.'
  }
]

export const RAW_STEP_BY_TYPE = new Map<string, StepKey>([
  ['ocr', 'documentOcr'],
  ['url', 'urlExtraction'],
  ['stt', 'transcription'],
  ['tts', 'tts']
])

export const DASHBOARD_STEP_BY_CATEGORY = new Map<string, StepKey>([
  ['download', 'download'],
  ['document', 'documentOcr'],
  ['url', 'urlExtraction'],
  ['transcription', 'transcription'],
  ['llm', 'llm'],
  ['tts', 'tts'],
  ['image', 'image'],
  ['video', 'video'],
  ['music', 'music']
])

export const QUALITY_METRIC_BY_RAW_TYPE = new Map<string, string>([
  ['ocr', 'WER accuracy score'],
  ['url', 'URL extraction accuracy score'],
  ['stt', 'speaker-aware WER score']
])

export const EXCLUDED_SERVICES = new Set([
  'unknown',
  'extract',
  'ocrmypdf',
  'paddle-ocr',
  'tesseract',
  'whisper',
  'kitten',
  'llama.cpp',
  'defuddle',
  'reverb'
])

export const QUALITY_STEPS = new Set<StepKey>(['documentOcr', 'urlExtraction', 'transcription'])

export const TOP_PICK_LIMIT_PER_BUCKET = 2
export const TOP_PICK_TARGET_COUNT = 6
export const TOP_PICK_BUCKET_DISPLAY_ORDER: readonly TopPickBucket[] = ['Fastest', 'Cheapest', 'Best']
