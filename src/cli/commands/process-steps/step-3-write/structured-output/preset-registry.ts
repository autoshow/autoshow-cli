import * as v from 'valibot'
import type { StructuredPresetName, ValibotSchema } from '~/types'

const TextSchema = v.pipe(v.string(), v.minLength(1))
const TimestampSchema = v.pipe(v.string(), v.regex(/^\d{2}:\d{2}:\d{2}$/))
const ConfidenceSchema = v.picklist(['high', 'medium', 'low'])
const HashtagSchema = v.pipe(v.string(), v.regex(/^#\S+$/))
const StringListSchema = v.array(TextSchema)
const HashtagListSchema = v.array(HashtagSchema)

const TweetSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(280))
const MetaTitleSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(60))
const MetaDescriptionSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(155))
const HookSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(125))

const ShortDescriptionSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(180))
const MediumDescriptionSchema = v.pipe(v.string(), v.minLength(50), v.maxLength(500))
const LongDescriptionSchema = v.pipe(v.string(), v.minLength(100), v.maxLength(1000))

const ShortSummarySchema = v.pipe(v.string(), v.minLength(50), v.maxLength(500))
const MediumSummarySchema = v.pipe(v.string(), v.minLength(200), v.maxLength(2000))
const LongSummarySchema = v.pipe(v.string(), v.minLength(500), v.maxLength(5000))

const ShortChapterDescriptionSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(200))
const MediumChapterDescriptionSchema = v.pipe(v.string(), v.minLength(50), v.maxLength(500))
const LongChapterDescriptionSchema = v.pipe(v.string(), v.minLength(100), v.maxLength(1000))

const ShortChapterSchema = v.object({
  timestamp: TimestampSchema,
  title: TextSchema,
  description: ShortChapterDescriptionSchema
})

const MediumChapterSchema = v.object({
  timestamp: TimestampSchema,
  title: TextSchema,
  description: MediumChapterDescriptionSchema
})

const LongChapterSchema = v.object({
  timestamp: TimestampSchema,
  title: TextSchema,
  description: LongChapterDescriptionSchema
})

const KeyMomentSchema = v.object({
  startTimestamp: TimestampSchema,
  endTimestamp: TimestampSchema,
  whyItMatters: TextSchema,
  transcriptExcerpt: TextSchema
})

const FaqItemSchema = v.object({
  question: TextSchema,
  answer: TextSchema
})

const TimestampedTitleSchema = v.object({
  timestamp: TimestampSchema,
  title: TextSchema
})

const TimestampedTitleQuoteSchema = v.object({
  timestamp: TimestampSchema,
  title: TextSchema,
  quote: TextSchema
})

const PdfChapterBoundarySchema = v.object({
  title: TextSchema,
  pdfStartPage: v.pipe(v.number(), v.integer(), v.minValue(1)),
  printedStartPage: v.optional(TextSchema, undefined),
  confidence: ConfidenceSchema,
  reason: TextSchema
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
    episodeDescription: ShortDescriptionSchema,
    episodeSummary: ShortSummarySchema
  }),
  longSummary: v.object({
    episodeDescription: LongDescriptionSchema,
    episodeSummary: LongSummarySchema
  }),
  bulletPoints: v.object({
    bulletPoints: StringListSchema
  }),
  takeaways: v.object({
    takeaways: v.pipe(StringListSchema, v.minLength(3), v.maxLength(3))
  }),
  quotes: v.object({
    quotes: v.pipe(StringListSchema, v.minLength(5), v.maxLength(5))
  }),
  titles: v.object({
    titles: v.pipe(StringListSchema, v.minLength(5), v.maxLength(5))
  }),
  metadata: MetadataSchema,
  faq: v.object({
    faq: v.pipe(v.array(FaqItemSchema), v.minLength(5), v.maxLength(10))
  }),
  questions: v.object({
    beginnerQuestions: v.pipe(StringListSchema, v.minLength(5), v.maxLength(5)),
    expertQuestions: v.pipe(StringListSchema, v.minLength(5), v.maxLength(5))
  }),
  chapterTitles: v.object({
    chapters: v.array(TimestampedTitleSchema)
  }),
  chapterTitlesAndQuotes: v.object({
    chapters: v.array(TimestampedTitleQuoteSchema)
  }),
  shortChapters: v.object({
    chapters: v.array(ShortChapterSchema)
  }),
  mediumChapters: v.object({
    chapters: v.array(MediumChapterSchema)
  }),
  longChapters: v.object({
    chapters: v.array(LongChapterSchema)
  }),
  keyMoments: v.object({
    keyMoments: v.array(KeyMomentSchema)
  }),
  summary: v.object({
    episodeDescription: MediumDescriptionSchema,
    episodeSummary: MediumSummarySchema
  }),
  blog: v.object({
    title: TextSchema,
    outline: StringListSchema,
    draft: TextSchema
  }),
  youtubeDescription: v.object({
    hook: HookSchema,
    body: TextSchema,
    timestamps: v.array(TimestampedTitleSchema),
    hashtags: HashtagListSchema
  }),
  seoArticle: v.object({
    metaTitle: MetaTitleSchema,
    metaDescription: MetaDescriptionSchema,
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
    content: TweetSchema,
    hashtags: HashtagListSchema
  }),
  tiktok: v.object({
    hook: TextSchema,
    content: TextSchema,
    hashtags: HashtagListSchema
  }),
  facebook: v.object({
    content: TextSchema
  }),
  instagram: v.object({
    caption: TextSchema,
    hashtags: HashtagListSchema
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
    poems: v.pipe(v.array(PoemSchema), v.minLength(6), v.maxLength(10)),
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
