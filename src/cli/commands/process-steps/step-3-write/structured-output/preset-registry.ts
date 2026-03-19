import * as v from 'valibot'
import type { ValibotSchema } from './types'

const TextSchema = v.pipe(v.string(), v.minLength(1))
const StringListSchema = v.array(TextSchema)

const ChapterSchema = v.object({
  timestamp: TextSchema,
  title: TextSchema,
  description: TextSchema
})

const KeyMomentSchema = v.object({
  startTimestamp: TextSchema,
  endTimestamp: TextSchema,
  whyItMatters: TextSchema,
  transcriptExcerpt: TextSchema
})

const FaqItemSchema = v.object({
  question: TextSchema,
  answer: TextSchema
})

const TimestampedTitleSchema = v.object({
  timestamp: TextSchema,
  title: TextSchema
})

const TimestampedTitleQuoteSchema = v.object({
  timestamp: TextSchema,
  title: TextSchema,
  quote: TextSchema
})

const QuestionsSchema = v.object({
  beginnerQuestions: StringListSchema,
  expertQuestions: StringListSchema
})

const MetadataSchema = v.object({
  date: TextSchema,
  location: TextSchema,
  participants: StringListSchema,
  topic: TextSchema
})

const FreeformEnvelopeSchema = v.object({
  content: TextSchema
})

const PRESET_REGISTRY = {
  shortSummary: v.object({
    episodeDescription: TextSchema
  }),
  longSummary: v.object({
    episodeSummary: TextSchema
  }),
  chapters: v.object({
    chapters: v.array(ChapterSchema)
  }),
  bulletPoints: v.object({
    bulletPoints: StringListSchema
  }),
  takeaways: v.object({
    takeaways: StringListSchema
  }),
  quotes: v.object({
    quotes: StringListSchema
  }),
  titles: v.object({
    titles: StringListSchema
  }),
  metadata: MetadataSchema,
  faq: v.object({
    faq: v.array(FaqItemSchema)
  }),
  questions: QuestionsSchema,
  chapterTitles: v.object({
    chapters: v.array(TimestampedTitleSchema)
  }),
  chapterTitlesAndQuotes: v.object({
    chapters: v.array(TimestampedTitleQuoteSchema)
  }),
  shortChapters: v.object({
    chapters: v.array(ChapterSchema)
  }),
  mediumChapters: v.object({
    chapters: v.array(ChapterSchema)
  }),
  longChapters: v.object({
    chapters: v.array(ChapterSchema)
  }),
  keyMoments: v.object({
    keyMoments: v.array(KeyMomentSchema)
  }),
  summary: v.object({
    episodeDescription: TextSchema,
    episodeSummary: TextSchema
  }),
  blog: v.object({
    title: TextSchema,
    outline: StringListSchema,
    draft: TextSchema
  }),
  youtubeDescription: v.object({
    hook: TextSchema,
    body: TextSchema,
    timestamps: v.array(TimestampedTitleSchema),
    hashtags: StringListSchema
  }),
  seoArticle: v.object({
    metaTitle: TextSchema,
    metaDescription: TextSchema,
    article: TextSchema,
    faq: v.array(FaqItemSchema)
  }),
  contentStrategy: v.object({
    strategyOverview: TextSchema,
    weeklyThemes: StringListSchema,
    channelPlan: StringListSchema
  }),
  emailNewsletter: v.object({
    subjectLine: TextSchema,
    previewText: TextSchema,
    body: TextSchema
  }),
  x: v.object({
    content: TextSchema,
    hashtags: StringListSchema
  }),
  tiktok: v.object({
    hook: TextSchema,
    content: TextSchema,
    hashtags: StringListSchema
  }),
  facebook: v.object({
    content: TextSchema
  }),
  instagram: v.object({
    caption: TextSchema,
    hashtags: StringListSchema
  }),
  linkedin: v.object({
    content: TextSchema
  }),
  freeformEnvelope: FreeformEnvelopeSchema
} as const

export type StructuredPresetName = keyof typeof PRESET_REGISTRY

export const getStructuredPresetSchema = (presetName: string): ValibotSchema => {
  const schema = PRESET_REGISTRY[presetName as StructuredPresetName]
  if (!schema) {
    const available = Object.keys(PRESET_REGISTRY).sort().join(', ')
    throw new Error(`Unknown structured preset "${presetName}". Available: ${available}`)
  }

  return schema
}

export const hasStructuredPreset = (presetName: string): boolean => {
  return presetName in PRESET_REGISTRY
}

export const composePromptObjectSchema = (entries: Array<{ key: string, schema: ValibotSchema }>): ValibotSchema => {
  const objectEntries: Record<string, v.GenericSchema> = {}
  for (const entry of entries) {
    objectEntries[entry.key] = entry.schema
  }
  return v.object(objectEntries)
}
