import type { PageResult } from '~/types'

export type EpubInspectEngine = 'bun' | 'calibre'

export type EpubContentEntry = {
  path: string
  size: number
  compressedSize?: number
}

export type EpubContentReader = {
  adapterLabel: string
  entries: EpubContentEntry[]
  hasEntry: (entryPath: string) => boolean
  readText: (entryPath: string) => Promise<string>
}

export type EpubMetadata = {
  title?: string
  creators: string[]
  language?: string
  identifier?: string
  description?: string
  publisher?: string
  publishedAt?: string
  subjects: string[]
}

export type EpubManifestItem = {
  id: string
  href: string
  path: string
  mediaType: string
  properties?: string
}

export type EpubSpineItem = {
  index: number
  idref: string
  linear: string
  manifestId?: string
  href?: string
  path?: string
}

export type EpubTocItem = {
  id?: string
  playOrder?: number
  title: string
  href?: string
  path?: string
  children: EpubTocItem[]
}

export type EpubChapter = {
  index: number
  idref: string
  href: string
  path: string
  title?: string
  text: string
  wordCount: number
  characterCount: number
}

export type EpubAssets = {
  images: string[]
  stylesheets: string[]
  fonts: string[]
  scripts: string[]
  other: string[]
}

export type EpubInspectionPayload = {
  schemaVersion: 1
  engine: EpubInspectEngine
  container: {
    rootfilePath: string
    mediaType?: string
  }
  packagePath: string
  metadata: EpubMetadata
  manifest: EpubManifestItem[]
  spine: EpubSpineItem[]
  toc: {
    source: 'ncx' | 'nav' | 'none'
    items: EpubTocItem[]
  }
  chapters: EpubChapter[]
  assets: EpubAssets
  inventory: {
    totalFiles: number
    files: EpubContentEntry[]
  }
  stats: {
    chapterCount: number
    totalWords: number
    totalCharacters: number
    totalFiles: number
  }
  diagnostics: {
    adapter: string
    warnings: string[]
  }
}

export type EpubInspectOutput = {
  payload: EpubInspectionPayload
  text: string
}

export type ZipEntry = {
  name: string
  method: number
  compSize: number
  uncompSize: number
  localOffset: number
}

export type OcrFn = (imagePath: string) => Promise<{ text: string, confidence?: number }>

export type HostedExtractOcrEngine = 'mistral-ocr' | 'glm-ocr'
export type LocalExtractOcrEngine = 'tesseract' | 'ocrmypdf' | 'paddle-ocr'

export type HostedOcrRun = {
  pages: PageResult[]
  extractionMethod: HostedExtractOcrEngine
  ocrService: 'mistral' | 'glm'
  ocrModel: string
  canonicalText?: string
  totalPages?: number
  promptTokens?: number
  completionTokens?: number
}

export type OcrTarget = {
  service: 'ocrmypdf' | 'paddle-ocr' | 'mistral' | 'glm'
  model: string
}
