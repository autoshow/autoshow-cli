import { defineCommand } from 'clerc'
import { runBenchmark } from './run-benchmark'
import type { BenchmarkFlags } from './benchmark-types'

export const benchmarkCommand = defineCommand({
  name: 'benchmark',
  description: 'Benchmark STT transcription quality across compression levels and playback speeds',
  parameters: [{ key: '[input]', description: 'Audio file path to benchmark' }],
  flags: {
    bitrates: {
      description: 'Comma-separated bitrate list in kbps',
      type: String,
      default: '128,96,64,48,32,24,16,8'
    },
    speeds: {
      description: 'Comma-separated speed multipliers',
      type: String,
      default: '1.25,1.5,2.0,2.5,3.0'
    },
    'stt-services': {
      description: 'Comma-separated STT services to test (default: all available)',
      type: String
    },
    'reference-stt': {
      description: 'Service:model for reference transcription (e.g., deepgram:nova-3)',
      type: String,
      default: 'deepgram:nova-3'
    },
    'skip-compression': {
      description: 'Skip compression spectrum tests',
      type: Boolean,
      default: false
    },
    'skip-speed': {
      description: 'Skip speed spectrum tests',
      type: Boolean,
      default: false
    },
    'output-dir': {
      description: 'Custom output directory for benchmark results',
      type: String
    }
  },
  help: {
    examples: [
      ['bun as benchmark input/examples/audio/1-audio.mp3', 'Run full benchmark with all available STT services'],
      ['bun as benchmark audio.mp3 --stt-services whisper', 'Benchmark with local Whisper only'],
      ['bun as benchmark audio.mp3 --stt-services deepgram,groq --skip-speed', 'Compression-only benchmark with select services'],
      ['bun as benchmark audio.mp3 --bitrates 96,64,32,16 --speeds 1.5,2.0,3.0', 'Custom bitrate and speed ranges']
    ]
  }
}, async (ctx) => {
  const flags = ctx.flags as unknown as BenchmarkFlags
  await runBenchmark(ctx.parameters.input, flags)
})
