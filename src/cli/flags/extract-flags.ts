import type { CliFlagsDefinition } from '~/cli/native'
import {
  allArticleFlags,
  batchFlags,
  booleanAllProvidersFlag,
  ocrInputFlags,
  ocrTuningFlags,
  priceFlag,
  sharedConcurrencyFlags,
  transcriptionFlags
} from './shared-flags'
import { epubInspectFlags } from './ocr-flags'
import { withHelpGroup } from './flag-utils'

const extractProviderSelectionFlags = {
  provider: {
    description: 'STT: whisper|reverb|deepinfra|elevenlabs|deepgram|soniox|speechmatics|rev|groq|grok|mistral|assemblyai|gladia|happyscribe|supadata|scrapecreators|openai|gemini|glm|together (default: whisper=tiny)\nOCR: tesseract|ocrmypdf|paddle-ocr|mistral|glm|kimi|openai|grok|anthropic|gemini|deepinfra|unstructured (default: tesseract)\nrepeatable as provider[=model]',
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

const extractDocumentFlags = {
  ...ocrInputFlags,
  ...ocrTuningFlags,
  'primary-ocr': {
    description: 'In multi-provider OCR, write top-level extraction artifacts from one requested provider: tesseract|ocrmypdf|paddle-ocr|mistral|glm|kimi|openai|grok|anthropic|gemini|deepinfra|unstructured (as service or service/model)',
    type: String
  }
} as const satisfies CliFlagsDefinition

export const extractStep2CommandFlags = {
  ...withHelpGroup(extractProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(transcriptionFlags, 'transcription'),
  ...withHelpGroup(extractDocumentFlags, 'ocr-document'),
  ...withHelpGroup(allArticleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
  ...withHelpGroup(epubInspectFlags, 'epub-inspect'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
