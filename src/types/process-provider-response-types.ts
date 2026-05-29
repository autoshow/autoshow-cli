import * as v from 'valibot'

const GladiaWordSchema = v.object({
  word: v.string(),
  start: v.number(),
  end: v.number(),
  confidence: v.optional(v.number(), undefined),
  speaker: v.optional(v.union([v.string(), v.number()]), undefined)
})

const GladiaUtteranceSchema = v.object({
  start: v.number(),
  end: v.number(),
  confidence: v.number(),
  channel: v.optional(v.number(), undefined),
  words: v.optional(v.array(GladiaWordSchema), undefined),
  text: v.string(),
  language: v.optional(v.string(), undefined),
  speaker: v.optional(v.union([v.string(), v.number()]), undefined)
})

const GladiaUploadAudioMetadataSchema = v.object({
  id: v.string(),
  filename: v.optional(v.nullable(v.string()), undefined),
  source: v.optional(v.string(), undefined),
  extension: v.string(),
  size: v.number(),
  audio_duration: v.number(),
  number_of_channels: v.number()
})

export const GladiaUploadResponseSchema = v.object({
  audio_url: v.string(),
  audio_metadata: GladiaUploadAudioMetadataSchema
})

export const GladiaCreateResponseSchema = v.object({
  id: v.string(),
  result_url: v.string()
})

const GladiaTranscriptionResultSchema = v.looseObject({
  full_transcript: v.optional(v.string(), undefined),
  languages: v.optional(v.array(v.string()), undefined),
  utterances: v.optional(v.array(GladiaUtteranceSchema), undefined)
})

const GladiaDiarizationResultSchema = v.looseObject({
  results: v.optional(v.array(GladiaUtteranceSchema), undefined)
})

export const GladiaStatusResponseSchema = v.looseObject({
  id: v.string(),
  status: v.picklist(['queued', 'processing', 'done', 'error']),
  request_id: v.optional(v.string(), undefined),
  created_at: v.optional(v.string(), undefined),
  completed_at: v.optional(v.nullable(v.string()), undefined),
  error_code: v.optional(v.nullable(v.number()), undefined),
  message: v.optional(v.string(), undefined),
  result: v.optional(v.nullable(v.looseObject({
    metadata: v.optional(v.looseObject({
      audio_duration: v.optional(v.number(), undefined),
      number_of_distinct_channels: v.optional(v.number(), undefined),
      billing_time: v.optional(v.number(), undefined),
      transcription_time: v.optional(v.number(), undefined)
    }), undefined),
    transcription: v.optional(GladiaTranscriptionResultSchema, undefined),
    diarization: v.optional(GladiaDiarizationResultSchema, undefined)
  })), undefined)
})

const MistralTranscriptionSegmentSchema = v.looseObject({
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speakerId: v.optional(v.nullable(v.union([v.string(), v.number()])), undefined),
  speaker_id: v.optional(v.nullable(v.union([v.string(), v.number()])), undefined),
  type: v.optional(v.string(), undefined)
})

export const MistralTranscriptionResponseSchema = v.looseObject({
  model: v.optional(v.string(), undefined),
  text: v.optional(v.string(), undefined),
  language: v.optional(v.nullable(v.string()), undefined),
  segments: v.optional(v.array(MistralTranscriptionSegmentSchema), undefined),
  usage: v.optional(v.looseObject({
    promptAudioSeconds: v.optional(v.nullable(v.number()), undefined),
    prompt_audio_seconds: v.optional(v.nullable(v.number()), undefined)
  }), undefined),
})

const MistralOcrPageSchema = v.object({
  index: v.number(),
  markdown: v.string()
})

export const MistralOcrResponseSchema = v.object({
  pages: v.array(MistralOcrPageSchema),
  model: v.optional(v.string(), undefined),
  usage_info: v.optional(v.object({
    pages_processed: v.optional(v.number(), undefined),
    doc_size_bytes: v.optional(v.number(), undefined)
  }), undefined)
})

const GlmOcrLayoutDetailSchema = v.looseObject({
  index: v.number(),
  label: v.string(),
  bbox_2d: v.optional(v.array(v.number()), undefined),
  content: v.optional(v.string(), undefined),
  height: v.optional(v.number(), undefined),
  width: v.optional(v.number(), undefined)
})

export const GlmOcrResponseSchema = v.looseObject({
  id: v.optional(v.string(), undefined),
  created: v.optional(v.number(), undefined),
  model: v.optional(v.string(), undefined),
  md_results: v.string(),
  layout_details: v.optional(v.array(v.array(GlmOcrLayoutDetailSchema)), undefined),
  data_info: v.optional(v.looseObject({
    num_pages: v.optional(v.number(), undefined),
    pages: v.optional(v.array(v.looseObject({
      width: v.optional(v.number(), undefined),
      height: v.optional(v.number(), undefined)
    })), undefined)
  }), undefined),
  usage: v.optional(v.looseObject({
    prompt_tokens: v.optional(v.number(), undefined),
    completion_tokens: v.optional(v.number(), undefined),
    total_tokens: v.optional(v.number(), undefined)
  }), undefined),
  request_id: v.optional(v.string(), undefined)
})

const WhisperJsonSegmentSchema = v.object({
  timestamps: v.object({
    from: v.string(),
    to: v.string()
  }),
  offsets: v.object({
    from: v.number(),
    to: v.number()
  }),
  text: v.string()
})

export const WhisperJsonOutputSchema = v.object({
  transcription: v.array(WhisperJsonSegmentSchema)
})

const ReverbWordSchema = v.object({
  word: v.string(),
  start: v.number(),
  end: v.number(),
  speaker: v.optional(v.string(), undefined)
})

const ReverbSegmentSchema = v.object({
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker: v.optional(v.string(), undefined),
  words: v.optional(v.array(ReverbWordSchema), undefined)
})

export const ReverbOutputSchema = v.object({
  segments: v.array(ReverbSegmentSchema),
  text: v.string(),
  speakers: v.optional(v.array(v.string()), undefined)
})

const ElevenLabsTimestampSchema = v.union([v.number(), v.string()])

const ElevenLabsWordSchema = v.object({
  text: v.optional(v.string(), undefined),
  word: v.optional(v.string(), undefined),
  start: v.optional(ElevenLabsTimestampSchema, undefined),
  end: v.optional(ElevenLabsTimestampSchema, undefined),
  speaker_id: v.optional(v.union([v.string(), v.number()]), undefined),
  type: v.optional(v.string(), undefined)
})

const ElevenLabsSegmentSchema = v.object({
  text: v.optional(v.string(), undefined),
  start: v.optional(ElevenLabsTimestampSchema, undefined),
  end: v.optional(ElevenLabsTimestampSchema, undefined),
  speaker_id: v.optional(v.union([v.string(), v.number()]), undefined)
})

export const ElevenLabsSttResponseSchema = v.object({
  text: v.optional(v.string(), undefined),
  words: v.optional(v.array(ElevenLabsWordSchema), undefined),
  segments: v.optional(v.array(ElevenLabsSegmentSchema), undefined)
})

const AssemblyAiUtteranceSchema = v.object({
  confidence: v.number(),
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker: v.string(),
  channel: v.optional(v.string(), undefined)
})

const AssemblyAiWordSchema = v.object({
  confidence: v.number(),
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker: v.optional(v.string(), undefined)
})

export const AssemblyAiTranscriptResponseSchema = v.object({
  id: v.string(),
  status: v.string(),
  text: v.optional(v.nullable(v.string()), undefined),
  utterances: v.optional(v.nullable(v.array(AssemblyAiUtteranceSchema)), undefined),
  words: v.optional(v.nullable(v.array(AssemblyAiWordSchema)), undefined),
  error: v.optional(v.nullable(v.string()), undefined)
})

const DeepgramWordSchema = v.object({
  word: v.optional(v.string(), undefined),
  punctuated_word: v.optional(v.string(), undefined),
  start: v.optional(v.number(), undefined),
  end: v.optional(v.number(), undefined),
  speaker: v.optional(v.number(), undefined)
})

const DeepgramAlternativeSchema = v.object({
  transcript: v.optional(v.string(), undefined),
  words: v.optional(v.array(DeepgramWordSchema), undefined)
})

const DeepgramChannelSchema = v.object({
  alternatives: v.optional(v.array(DeepgramAlternativeSchema), undefined)
})

const DeepgramUtteranceSchema = v.object({
  start: v.number(),
  end: v.number(),
  transcript: v.string(),
  speaker: v.number(),
  words: v.optional(v.array(DeepgramWordSchema), undefined)
})

export const DeepgramResponseSchema = v.object({
  results: v.object({
    channels: v.array(DeepgramChannelSchema),
    utterances: v.optional(v.array(DeepgramUtteranceSchema), undefined)
  })
})

export const SonioxFileResponseSchema = v.object({
  id: v.string()
})

export const SonioxTranscriptionStatusSchema = v.object({
  id: v.string(),
  status: v.picklist(['queued', 'processing', 'completed', 'error']),
  model: v.optional(v.string(), undefined),
  filename: v.optional(v.string(), undefined),
  enable_speaker_diarization: v.optional(v.boolean(), undefined),
  enable_language_identification: v.optional(v.boolean(), undefined),
  audio_duration_ms: v.optional(v.nullable(v.number()), undefined),
  error_type: v.optional(v.nullable(v.string()), undefined),
  error_message: v.optional(v.nullable(v.string()), undefined)
})

const SonioxTranscriptTokenSchema = v.object({
  text: v.string(),
  start_ms: v.optional(v.number(), undefined),
  end_ms: v.optional(v.number(), undefined),
  confidence: v.optional(v.number(), undefined),
  speaker: v.optional(v.nullable(v.union([v.string(), v.number()])), undefined),
  language: v.optional(v.nullable(v.string()), undefined),
  is_audio_event: v.optional(v.nullable(v.boolean()), undefined),
  translation_status: v.optional(v.nullable(v.string()), undefined)
})

export const SonioxTranscriptResponseSchema = v.object({
  id: v.string(),
  text: v.string(),
  tokens: v.array(SonioxTranscriptTokenSchema)
})

export const RevJobSchema = v.object({
  id: v.string(),
  status: v.picklist(['in_progress', 'transcribed', 'failed']),
  failure: v.optional(v.string(), undefined),
  failure_detail: v.optional(v.string(), undefined)
})

const RevTranscriptElementSchema = v.object({
  type: v.picklist(['text', 'punct']),
  value: v.string(),
  ts: v.optional(v.number(), undefined),
  end_ts: v.optional(v.number(), undefined),
  confidence: v.optional(v.number(), undefined)
})

const RevTranscriptMonologueSchema = v.object({
  speaker: v.number(),
  elements: v.array(RevTranscriptElementSchema)
})

export const RevTranscriptResponseSchema = v.object({
  monologues: v.array(RevTranscriptMonologueSchema)
})

const SpeechmaticsJobErrorSchema = v.object({
  type: v.optional(v.string(), undefined),
  message: v.optional(v.string(), undefined)
})

export const SpeechmaticsJobSchema = v.object({
  id: v.string(),
  status: v.picklist(['running', 'done', 'rejected']),
  created_at: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  data_name: v.optional(v.string(), undefined),
  error: v.optional(v.string(), undefined),
  errors: v.optional(v.array(SpeechmaticsJobErrorSchema), undefined)
})

export const SpeechmaticsJobResponseSchema = v.object({
  job: SpeechmaticsJobSchema
})

export const SpeechmaticsCreateJobResponseSchema = v.union([
  v.object({
    id: v.string()
  }),
  SpeechmaticsJobResponseSchema
])

const SpeechmaticsTranscriptJobSchema = v.object({
  id: v.string(),
  created_at: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  data_name: v.optional(v.string(), undefined)
})

const SpeechmaticsTranscriptAlternativeSchema = v.object({
  content: v.string(),
  confidence: v.optional(v.number(), undefined),
  language: v.optional(v.string(), undefined),
  speaker: v.optional(v.string(), undefined)
})

const SpeechmaticsTranscriptResultSchema = v.object({
  type: v.string(),
  start_time: v.number(),
  end_time: v.number(),
  is_eos: v.optional(v.boolean(), undefined),
  channel: v.optional(v.string(), undefined),
  alternatives: v.array(SpeechmaticsTranscriptAlternativeSchema)
})

export const SpeechmaticsTranscriptResponseSchema = v.object({
  format: v.optional(v.string(), undefined),
  job: v.optional(SpeechmaticsTranscriptJobSchema, undefined),
  results: v.array(SpeechmaticsTranscriptResultSchema)
})

export type GladiaStatusResponse = v.InferOutput<typeof GladiaStatusResponseSchema>
export type DeepgramResponse = v.InferOutput<typeof DeepgramResponseSchema>
