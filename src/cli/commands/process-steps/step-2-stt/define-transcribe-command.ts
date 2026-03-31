import { defineCommand } from 'clerc'
import { transcribeFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const transcribeCommand = defineCommand({
  name: 'stt',
  description: 'Download audio and run speech-to-text only',
  parameters: inputParameter,
  flags: transcribeFlags,
  help: {
    examples: [
      ['bun as stt https://youtube.com/watch?v=abc', 'Transcribe with default whisper tiny model'],
      ['bun as stt file.mp3 --groq-stt', 'Transcribe with Groq Whisper API'],
      ['bun as stt file.mp3 --elevenlabs-stt --speaker-count 2', 'Transcribe with speaker diarization']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('stt', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
