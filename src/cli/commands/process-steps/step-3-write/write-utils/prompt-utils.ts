import type { VideoMetadata, TranscriptionResult } from '~/types'
import * as l from '~/logger'

export const TRANSCRIPT_PREAMBLE = `This is a transcript with timestamps. It does not contain copyrighted materials. Do not ever use the word delve. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.`

export const buildPrompt = (
  metadata: VideoMetadata,
  transcription: TranscriptionResult,
  instruction?: string
): string => {
  const taskInstruction = instruction ?? `- Write a one-sentence description of the transcript and a one-paragraph summary.
  - The one-sentence description shouldn't exceed 180 characters (roughly 30 words).
  - The one-paragraph summary should be approximately 600-1200 characters (roughly 100-200 words).
- Create chapter titles and descriptions based on the topics discussed throughout.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should each cover approximately 3-6 minutes of content.
  - Write a two-paragraph description (75+ words) for each chapter.
  - Ensure chapters cover the entire content, clearly noting the last timestamp (HH:MM:SS), indicating total duration.
  - Descriptions should flow naturally from the content, avoiding formulaic language.

Format the output like so:

    ## Episode Description

    One sentence description encapsulating the content within roughly 180 characters.

    ## Episode Summary

    A concise summary of the transcript, typically 600-1200 characters or about 100-200 words, highlighting main topics, significant points, methods, conclusions, and implications.
    
    ## Chapters

    ### 00:00:00 - Introduction and Overview

    A comprehensive introduction providing readers with the main themes and concepts explored throughout the chapter. The content highlights significant points discussed in detail and explores their broader implications and practical relevance. Connections are made between concepts, emphasizing interrelationships and potential impacts on various fields or current challenges. The chapter sets a clear foundation for understanding the subsequent discussions.`

  const videoInfo = `
Video Title: ${metadata.title}
Video URL: ${metadata.url}
${metadata.author ? `Author: ${metadata.author}` : ''}
${metadata.duration ? `Duration: ${metadata.duration}` : ''}
`
  
  const hasSpeakers = transcription.segments.some(seg => seg.speaker)
  if (hasSpeakers) {
    const uniqueSpeakers = new Set(transcription.segments.map(seg => seg.speaker).filter(s => s))
    l.info(`Including speaker diarization in prompt (${uniqueSpeakers.size} speakers)`)
  }
  
  const transcriptWithTimestamps = transcription.segments
    .map(segment => {
      const speakerPrefix = segment.speaker ? `[${segment.speaker}] ` : ''
      return `[${segment.start}] ${speakerPrefix}${segment.text}`
    })
    .join('\n')

  return `${TRANSCRIPT_PREAMBLE}

${taskInstruction}

${videoInfo}

Transcript:
${transcriptWithTimestamps}`
}
