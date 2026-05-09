import * as v from 'valibot'

export const VideoChapterSchema = v.object({
  startTime: v.number(),
  endTime: v.number(),
  title: v.string()
})

export const VideoMetadataSchema = v.object({
  title: v.string(),
  duration: v.string(),
  channel: v.string(),
  description: v.string(),
  url: v.pipe(v.string(), v.url()),
  publishDate: v.optional(v.string(), undefined),
  thumbnail: v.optional(v.string(), undefined),
  channelURL: v.optional(v.string(), undefined),
  chapters: v.optional(v.array(VideoChapterSchema), undefined)
})

export type Step1Metadata = VideoMetadata & {
  slug: string
  audioFileName: string
  audioFileSize: number
  mediaFileName?: string | undefined
  mediaFileSize?: number | undefined
  mediaKind?: 'audio' | 'video' | 'media' | undefined
}

const YtDlpChapterSchema = v.object({
  start_time: v.optional(v.number(), undefined),
  end_time: v.optional(v.number(), undefined),
  title: v.optional(v.string(), undefined)
})

const YtDlpSubtitleTrackSchema = v.object({
  ext: v.string(),
  url: v.string(),
  name: v.optional(v.string(), undefined)
})

export const YtDlpVideoInfoSchema = v.object({
  id: v.optional(v.string(), undefined),
  title: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  uploader: v.optional(v.string(), undefined),
  channel: v.optional(v.string(), undefined),
  channel_url: v.optional(v.string(), undefined),
  description: v.optional(v.string(), undefined),
  upload_date: v.optional(v.string(), undefined),
  thumbnail: v.optional(v.string(), undefined),
  chapters: v.optional(v.array(YtDlpChapterSchema), undefined),
  subtitles: v.optional(v.record(v.string(), v.array(YtDlpSubtitleTrackSchema)), undefined),
  automatic_captions: v.optional(v.record(v.string(), v.array(YtDlpSubtitleTrackSchema)), undefined)
})

export type VideoMetadata = v.InferOutput<typeof VideoMetadataSchema>
export type YtDlpVideoInfo = v.InferOutput<typeof YtDlpVideoInfoSchema>
