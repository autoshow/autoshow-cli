import { mkdir, rm } from 'node:fs/promises'
import type { TranscriptionResult, Step2Metadata } from '~/types'
import * as l from '~/logger'
import { countTokens, formatTranscriptText } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { parseWhisperJson, extractWhisperWords } from './parse-whisper-output'
import { fileExists } from '~/utils/cli-utils'
import { resolve } from 'node:path'
import { whisperBinaryPath, whisperModelsDir } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import { pollUntil } from '~/utils/retries'
import { formatWhisperProgressMessage, parseWhisperProgressPercent } from './whisper-progress'
import { prepareLocalSttInput } from '../local-audio-normalize'

const WHISPER_JSON_WAIT_TIMEOUT_MS = 3000
const WHISPER_JSON_WAIT_POLL_MS = 100

const coremlEncoderLookupCache = new Map<string, Promise<string | null>>()

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | null,
  options?: { onLine?: (line: string) => void }
): Promise<string> => {
  if (!stream) {
    return ''
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let pendingLine = ''

  const flushPendingLines = (chunk: string, allowPartial: boolean): void => {
    if (!options?.onLine || chunk.length === 0) {
      return
    }

    pendingLine += chunk

    while (true) {
      const lineBreakIndex = pendingLine.indexOf('\n')
      if (lineBreakIndex < 0) {
        break
      }
      const line = pendingLine.slice(0, lineBreakIndex).replace(/\r$/, '')
      pendingLine = pendingLine.slice(lineBreakIndex + 1)
      options.onLine(line)
    }

    if (allowPartial && pendingLine.length > 0) {
      options.onLine(pendingLine.replace(/\r$/, ''))
      pendingLine = ''
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      const chunk = decoder.decode(value, { stream: true })
      fullText += chunk
      flushPendingLines(chunk, false)
    }

    const trailing = decoder.decode()
    fullText += trailing
    flushPendingLines(trailing, true)
  } finally {
    reader.releaseLock()
  }

  return fullText
}

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
    segmentStartSeconds?: number | undefined
    segmentDurationSeconds?: number | undefined
    totalDurationSeconds?: number | undefined
    preserveJson?: boolean | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    segmentStartSeconds,
    segmentDurationSeconds,
    totalDurationSeconds,
    preserveJson = false
  } = options
  let preparedInput: Awaited<ReturnType<typeof prepareLocalSttInput>> | undefined

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
    preparedInput = await prepareLocalSttInput(audioPath, 'autoshow-whisper-')
    const coreMLEncoderPath = await detectCoreMLEncoder(modelName)
    const whisperArgs = [
      '-m', modelPath,
      '-f', preparedInput.audioPath,
      '-ml', '1',
      '-np',
      '-pp',
      '-of', outputBase,
      '-ojf'
    ]
    const proc = Bun.spawn([whisperBinary, ...whisperArgs], {
      stdout: 'pipe',
      stderr: 'pipe'
    })

    let lastLoggedProgress: number | null = null
    l.info(formatWhisperProgressMessage(0, {
      segmentNumber,
      totalSegments,
      segmentStartSeconds,
      segmentDurationSeconds,
      totalDurationSeconds
    }))
    lastLoggedProgress = 0
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr, {
        onLine: (line) => {
          const progressPercent = parseWhisperProgressPercent(line)
          if (progressPercent === null || progressPercent === lastLoggedProgress) {
            return
          }
          lastLoggedProgress = progressPercent
          l.info(formatWhisperProgressMessage(progressPercent, {
            segmentNumber,
            totalSegments,
            segmentStartSeconds,
            segmentDurationSeconds,
            totalDurationSeconds
          }))
        }
      }),
      proc.exited
    ])
    const result = { stdout, stderr, exitCode }
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
    const rawResponse = JSON.parse(jsonText) as unknown
    let words = extractWhisperWords(jsonText)
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
      words = shiftedWords
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
      result: {
        text,
        segments,
        evidence: {
          words: words.map((word) => ({
            startSeconds: word.start,
            endSeconds: word.end,
            text: word.word,
            normalized: word.word.toLowerCase(),
            timingSource: 'native'
          })),
          capabilities: {
            hasNativeWordTiming: true,
            hasConfidence: false,
            hasSpeakerLabels: false
          },
          timingQuality: 'native_word',
          rawResponse
        }
      },
      metadata
    }
  } catch (error) {
    l.error(`Failed to transcribe audio`, error)
    throw error
  } finally {
    await preparedInput?.cleanup()
  }
}
