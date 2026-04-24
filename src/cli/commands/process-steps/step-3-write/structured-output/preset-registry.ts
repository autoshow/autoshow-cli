import * as v from 'valibot'
import type { StructuredPresetName, ValibotSchema } from '~/types'

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

const PdfChapterBoundarySchema = v.object({
  title: TextSchema,
  pdfStartPage: v.pipe(v.number(), v.integer(), v.minValue(1)),
  printedStartPage: v.optional(TextSchema, undefined),
  confidence: TextSchema,
  reason: TextSchema
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

const PoemSchema = v.object({
  title: TextSchema,
  form: TextSchema,
  text: TextSchema
})

const ScreenplayDialogueSchema = v.object({
  character: TextSchema,
  line: TextSchema
})

const ScreenplaySceneSchema = v.object({
  heading: TextSchema,
  action: TextSchema,
  dialogue: v.array(ScreenplayDialogueSchema)
})

const ShortStoryActSchema = v.object({
  title: TextSchema,
  summary: TextSchema,
  prose: TextSchema
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
  pdfChapterBoundaries: v.object({
    chapters: v.array(PdfChapterBoundarySchema)
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
  songLyrics: v.object({
    title: TextSchema,
    lyrics: TextSchema
  }),
  poetryCollection: v.object({
    title: TextSchema,
    theme: TextSchema,
    poems: v.array(PoemSchema),
    collectionNotes: TextSchema
  }),
  screenplay: v.object({
    title: TextSchema,
    logline: TextSchema,
    scenes: v.array(ScreenplaySceneSchema),
    productionNotes: StringListSchema
  }),
  shortStory: v.object({
    title: TextSchema,
    genre: TextSchema,
    acts: v.array(ShortStoryActSchema),
    themes: StringListSchema
  }),
  freeformEnvelope: FreeformEnvelopeSchema
} as const satisfies Record<StructuredPresetName, ValibotSchema>

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
