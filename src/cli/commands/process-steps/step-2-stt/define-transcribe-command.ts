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
      ['bun as stt file.mp3 --deepgram-stt', 'Transcribe with Deepgram Nova-3'],
      ['bun as stt file.mp3 --soniox-stt', 'Transcribe with Soniox async diarization'],
      ['bun as stt file.mp3 --speechmatics-stt', 'Transcribe with Speechmatics batch diarization'],
      ['bun as stt file.mp3 --rev-stt', 'Transcribe with Rev async diarization'],
      ['bun as stt --resume-missing', 'Resume the newest compatible incomplete STT batch under ./output'],
      ['bun as stt file.mp3 --elevenlabs-stt', 'Transcribe with ElevenLabs speaker diarization'],
      ['bun as stt file.mp3 --elevenlabs-stt --speaker-count 2', 'Transcribe with ElevenLabs diarization and a speaker-count hint'],
      ['bun as stt file.mp3 --openai-stt gpt-4o-transcribe-diarize --speaker-name Host --speaker-reference clips/host.mp3 --speaker-name Guest --speaker-reference clips/guest.mp3', 'Transcribe with OpenAI known speaker references']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('stt', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
