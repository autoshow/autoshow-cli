import { defineCliCommand } from '~/cli/native'
import { extractStep2CommandFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { validateEpubInspectCommandFlags } from './step-2-ocr/command-validation'
import { runExtractTranscriptVideo } from './transcript-video/run-transcript-video'
import { CLIUsageError } from '~/utils/error-handler'
import type { CliFlagsDefinition } from '~/cli/native'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, URL list (.md/.txt), or X Space link' }] as const

const extractFlags = {
  ...extractStep2CommandFlags,
  'transcript-video': {
    description: 'Render a transcript video from a media extract output directory or manual audio/transcript files',
    type: Boolean,
    default: false,
    negatable: false
  },
  audio: {
    description: 'Transcript video: audio file for manual rendering, or override audio inferred from an extract run',
    type: String
  },
  'transcript-result': {
    description: 'Transcript video: STT result.json file to render',
    type: String
  },
  'transcript-text': {
    description: 'Transcript video: timestamped transcription.txt file to render',
    type: String
  },
  font: {
    description: 'Transcript video: font family used for rendered transcript text (default: DejaVu Sans)',
    type: String,
    default: 'DejaVu Sans'
  },
  'keep-tmp': {
    description: 'Transcript video: keep the per-run .transcript-video-tmp workspace in the output directory',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const TRANSCRIPT_VIDEO_REQUIRING_FLAGS = [
  'audio',
  'transcript-result',
  'transcript-text',
  'font',
  'keep-tmp'
] as const

export const extractCommand = defineCliCommand({
  name: 'extract',
  description: 'Route media to STT and documents/articles/images to text extraction',
  parameters: inputParameter,
  flags: extractFlags,
  help: {
    examples: [
      ['bun as extract https://youtube.com/watch?v=abc', 'Transcribe media with the default Whisper tiny STT model'],
      ['bun as extract file.mp3 --assemblyai universal-3-pro', 'Transcribe media with AssemblyAI STT'],
      ['bun as extract document.pdf --mistral mistral-ocr-2512', 'Extract text from a document with Mistral OCR'],
      ['bun as extract https://example.com/article --url-backend spider', 'Extract a remote article with a URL backend'],
      ['bun as extract output/<extract-run-dir> --transcript-video', 'Render a synced speaker transcript video from a media extract run'],
      ['bun as extract --transcript-video --audio input/audio.mp3 --transcript-result output/<extract-run-dir>/result.json', 'Render a transcript video from explicit files'],
      ['bun as extract input/examples/batch/2-urls.md --batch-all', 'Process every routed item from a mixed input list'],
      ['bun as extract https://x.com/i/spaces/1DXxyRYNejbKM', 'Extract X Space metadata via the X API']
    ]
  }
}, async (ctx) => {
  const transcriptVideo = ctx.flags['transcript-video'] === true
  if (transcriptVideo) {
    await runExtractTranscriptVideo(ctx.parameters.input, ctx.flags)
    return
  }

  const transcriptVideoOnlyFlags = TRANSCRIPT_VIDEO_REQUIRING_FLAGS
    .filter((flag) => ctx.rawParsed.explicitFlags.has(flag))
    .map((flag) => `--${flag}`)
  if (transcriptVideoOnlyFlags.length > 0) {
    throw CLIUsageError(`${transcriptVideoOnlyFlags.join(', ')} require --transcript-video`)
  }

  validateEpubInspectCommandFlags(ctx)
  await handleProcessTarget('extract', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
