import { expect, test } from 'bun:test'
import {
  computeWhisperOverallPercent,
  formatWhisperProgressMessage,
  parseWhisperProgressPercent,
} from '~/cli/commands/process-steps/step-2-stt/stt-local/whisper/whisper-progress'

test('parseWhisperProgressPercent parses whisper.cpp progress lines', () => {
  expect(parseWhisperProgressPercent('whisper_print_progress_callback: progress =   5%')).toBe(5)
  expect(parseWhisperProgressPercent('whisper_print_progress_callback: progress = 100%')).toBe(100)
})

test('parseWhisperProgressPercent ignores unrelated stderr lines', () => {
  expect(parseWhisperProgressPercent("output_json: saving output to '/tmp/out.json'")).toBeNull()
  expect(parseWhisperProgressPercent('')).toBeNull()
})

test('formatWhisperProgressMessage renders a line progress bar for single-file runs', () => {
  expect(formatWhisperProgressMessage(35)).toBe('Whisper progress [=======>                ] 35%')
})

test('computeWhisperOverallPercent weights progress by elapsed audio duration', () => {
  const percent = computeWhisperOverallPercent(50, {
    segmentNumber: 2,
    totalSegments: 3,
    segmentStartSeconds: 600,
    segmentDurationSeconds: 300,
    totalDurationSeconds: 1500
  })

  expect(percent).toBe(50)
})

test('formatWhisperProgressMessage handles a shorter final split segment', () => {
  expect(formatWhisperProgressMessage(50, {
    segmentNumber: 3,
    totalSegments: 3,
    segmentStartSeconds: 1200,
    segmentDurationSeconds: 45,
    totalDurationSeconds: 1245
  })).toBe('Whisper progress [========================] 98% overall (segment 3/3: 50%)')
})
