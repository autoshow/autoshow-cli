import type { PriceSelectionEntry } from '~/types'
import { downloadRegistry } from './download'
import { imageRegistry } from './image'
import { musicRegistry } from './music'
import { ocrRegistry } from './ocr'
import { sttRegistry } from './stt'
import { ttsRegistry } from './tts'
import { videoRegistry } from './video'
import { writeRegistry } from './write'

export const PRICE_SELECTION_REGISTRY: PriceSelectionEntry[] = [
  ...downloadRegistry,
  ...sttRegistry,
  ...writeRegistry,
  ...ttsRegistry,
  ...imageRegistry,
  ...videoRegistry,
  ...musicRegistry,
  ...ocrRegistry,
]
