import { mkdir, rm } from 'node:fs/promises'
import type { TranscriptionResult, Step2Metadata } from '~/types'
import * as l from '~/logger'
import { countTokens, formatTranscriptText } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { parseWhisperJson, extractWhisperWords } from './parse-whisper-output'
import { fileExists, exec } from '~/utils/cli-utils'
import { resolve } from 'node:path'
import { whisperBinaryPath, whisperModelsDir } from '~/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup'
import { pollUntil } from '~/utils/retries'

const WHISPER_JSON_WAIT_TIMEOUT_MS = 3000
const WHISPER_JSON_WAIT_POLL_MS = 100

const coremlEncoderLookupCache = new Map<string, Promise<string | null>>()

const detectCoreMLEncoder = async (modelName: string): Promise<string | null> => {
  const cached = coremlEncoderLookupCache.get(modelName)
  if (cached) {
    return await cached
  }

  const modelsDir = whisperModelsDir
  const candidates = [
    `${modelsDir}/ggml-${modelName}-encoder.mlmodelc`,
    `${modelsDir}/ggml-${modelName}-encoder.mlpackage`,
    `${modelsDir}/coreml-encoder-${modelName}.mlmodelc`,
    `${modelsDir}/coreml-encoder-${modelName}.mlpackage`
  ]
  const lookup = Promise.all(candidates.map(p => fileExists(p))).then(checks => {
    const idx = checks.findIndex(ok => ok)
    return idx >= 0 ? candidates[idx]! : null
  })
  coremlEncoderLookupCache.set(modelName, lookup)
  return await lookup
}

const waitForWhisperJson = async (jsonFile: string): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: 'whisper-json-output',
      intervalMs: WHISPER_JSON_WAIT_POLL_MS,
      deadlineMs: WHISPER_JSON_WAIT_TIMEOUT_MS,
      pollFn: async () => await fileExists(jsonFile),
      isDone: (exists) => exists
    })
    return true
  } catch {
    return await fileExists(jsonFile)
  }
}

export const runWhisperTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    preserveJson?: boolean | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments, preserveJson = false } = options
  try {
    if (segmentNumber && totalSegments) {
      l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with model: ${modelName}`)
    }
    const startTime = Date.now()
    const modelPath = `${whisperModelsDir}/ggml-${modelName}.bin`
    const whisperBinary = whisperBinaryPath
    const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
    const outputDirAbs = resolve(outputDir)
    await mkdir(outputDirAbs, { recursive: true })
    const outputBase = resolve(outputDirAbs, `transcription${segmentSuffix}`)
    const coreMLEncoderPath = await detectCoreMLEncoder(modelName)
    const result = await exec(whisperBinary, [
      '-m', modelPath,
      '-f', audioPath,
      '-ml', '1',
      '-of', outputBase,
      '-ojf'
    ])
    if (result.exitCode !== 0) {
      throw new Error(`Whisper transcription failed: ${result.stderr}`)
    }
    const jsonFile = `${outputBase}.json`
    const jsonReady = await waitForWhisperJson(jsonFile)
    if (!jsonReady) {
      const commandOutput = result.stderr.trim() || result.stdout.trim()
      const outputDirExists = await fileExists(outputDirAbs)
      throw new Error(
        commandOutput.length > 0
          ? `Whisper transcription completed but no JSON output was produced at ${jsonFile} (output dir exists: ${outputDirExists}). Command output:\n${commandOutput}`
          : `Whisper transcription completed but no JSON output was produced at ${jsonFile} (output dir exists: ${outputDirExists})`
      )
    }
    const jsonText = await Bun.file(jsonFile).text()
    const words = extractWhisperWords(jsonText)
    await Bun.write(`${outputBase}.words.json`, JSON.stringify(words))
    let { text, segments } = parseWhisperJson(jsonText)
    if (segmentOffsetMinutes > 0) {
      const offsetSeconds = segmentOffsetMinutes * 60
      segments = segments.map(seg => {
        const partsS = seg.start.split(':')
        const partsE = seg.end.split(':')
        const s = parseInt(partsS[0]!) * 3600 + parseInt(partsS[1]!) * 60 + parseInt(partsS[2]!) + offsetSeconds
        const e = parseInt(partsE[0]!) * 3600 + parseInt(partsE[1]!) * 60 + parseInt(partsE[2]!) + offsetSeconds
        const sh = Math.floor(s / 3600)
        const sm = Math.floor((s % 3600) / 60)
        const ss = s % 60
        const eh = Math.floor(e / 3600)
        const em = Math.floor((e % 3600) / 60)
        const es = e % 60
        return {
          ...seg,
          start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
          end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:${String(es).padStart(2, '0')}`
        }
      })
      const shiftedWords = words.map(w => ({ ...w, start: w.start + offsetSeconds, end: w.end + offsetSeconds }))
      await Bun.write(`${outputBase}.words.json`, JSON.stringify(shiftedWords))
    }
    if (!preserveJson) {
      await rm(jsonFile, { force: true })
    }
    const processingTime = Date.now() - startTime
    const tokenCount = countTokens(text)
    const descriptorParts = [modelPath]
    if (coreMLEncoderPath) descriptorParts.push(`coreml:${coreMLEncoderPath}`)
    const transcriptionModelDescriptor = descriptorParts.join(' | ')
    if (segmentNumber && totalSegments) {
      l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
    }
    await Bun.write(`${outputBase}.txt`, formatTranscriptText(segments))
    const metadata: Step2Metadata = {
      transcriptionService: 'whisper',
      transcriptionModel: transcriptionModelDescriptor,
      transcriptionModelName: modelName,
      processingTime,
      tokenCount
    }
    return {
      result: { text, segments },
      metadata
    }
  } catch (error) {
    l.error(`Failed to transcribe audio`, error)
    throw error
  }
}
