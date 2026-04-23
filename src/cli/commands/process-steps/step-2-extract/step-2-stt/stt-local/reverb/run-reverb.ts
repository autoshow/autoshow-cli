import { readdir, rm } from 'node:fs/promises'
import type { TranscriptionResult, Step2Metadata } from '~/types'
import * as l from '~/utils/logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { countTokens, formatTranscriptText } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { parseReverbWithSpeakers, parseReverbTextOutput } from './parse-reverb-output'
import { exec } from '~/utils/cli-utils'
import { getHuggingFaceToken, runDiarization, mergeASRWithDiarization, findCTMFile } from './run-reverb-diarization'
import { reverbUvEnvDir, reverbModelDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pollUntil } from '~/utils/retries'
import { prepareLocalSttInput } from '../local-audio-normalize'

let detectedGpuSupportPromise: Promise<boolean> | null = null

const detectGpuSupport = async (): Promise<boolean> => {
  if (detectedGpuSupportPromise) {
    return await detectedGpuSupportPromise
  }

  detectedGpuSupportPromise = (async () => {
    try {
      const proc = Bun.spawn(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'], {
        stdout: 'pipe',
        stderr: 'pipe'
      })
      const stdout = await new Response(proc.stdout).text()
      const exitCode = await proc.exited
      const hasGpu = exitCode === 0
      if (hasGpu) {
        l.write('info', `GPU detected: ${stdout.trim()}`)
      }
      return hasGpu
    } catch {
      return false
    }
  })()

  return await detectedGpuSupportPromise
}

const listFilesRecursive = async (rootDir: string): Promise<string[]> => {
  const discovered: string[] = []

  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(path)
        return
      }
      if (entry.isFile()) {
        discovered.push(path)
      }
    }))
  }

  try {
    await walk(rootDir)
    return discovered
  } catch {
    return []
  }
}

const waitForReverbResultFiles = async (resultDir: string): Promise<void> => {
  try {
    await pollUntil({
      operationName: 'reverb-output-files',
      intervalMs: 100,
      deadlineMs: 3000,
      pollFn: async () => {
        const files = await listFilesRecursive(resultDir)
        return files.some(path => path.endsWith('.txt') || path.endsWith('.text') || path.endsWith('.ctm') || path.endsWith('.json'))
      },
      isDone: ready => ready
    })
  } catch {
  }
}

const findAndReadOutputFile = async (resultDir: string): Promise<string | null> => {
  try {
    const files = await listFilesRecursive(resultDir)
    const textFile = files.find(path => path.endsWith('.txt') || path.endsWith('.text'))
    if (textFile) {
      const content = await Bun.file(textFile).text()
      return content
    }

    const ctmFile = files.find(path => path.endsWith('.ctm'))
    if (ctmFile) {
      const ctmContent = await Bun.file(ctmFile).text()
      const lines = ctmContent.split('\n').filter((line: string) => line.trim())
      const words = lines.map((line: string) => {
        const parts = line.split(/\s+/)
        const word = parts[4]
        return word || ''
      }).filter(word => word && word !== "'")
      const content = words.join(' ')
      return content
    }

    const jsonFile = files.find(path => path.endsWith('.json'))
    if (jsonFile) {
      const jsonContent = await Bun.file(jsonFile).text()
      try {
        const data = JSON.parse(jsonContent)
        let content = ''
        if (typeof data === 'string') content = data
        else if (data.text) content = data.text
        else if (data.result && data.result.text) content = data.result.text
        else if (Array.isArray(data)) content = data.map(item => item.text || item.word || '').join(' ')
        else if (data.transcription) content = data.transcription
        if (content) return content
      } catch (error) {
        l.error(`Failed to parse JSON file`, error)
      }
    }
    return null
  } catch (error) {
    l.error(`Error reading output files`, error)
    return null
  }
}

const cleanupIntermediateFiles = async (resultDir: string): Promise<void> => {
  try {
    l.write('info', `Cleaning up intermediate Reverb files`)
    const files = await listFilesRecursive(resultDir)
    const ctmFileList = files.filter(path => path.endsWith('.ctm'))
    for (const ctmFile of ctmFileList) {
      await rm(ctmFile, { force: true })
      l.write('info', `Deleted CTM file: ${ctmFile}`)
    }
    const rttmPath = `${resultDir}/diarization.rttm`
    const rttmExists = await Bun.file(rttmPath).exists()
    if (rttmExists) {
      await rm(rttmPath, { force: true })
      l.write('info', `Deleted RTTM file: ${rttmPath}`)
    }
    await rm(resultDir, { recursive: true, force: true })
    l.write('success', `Cleaned up intermediate directory: ${resultDir}`)
  } catch (error) {
    l.warn(`Failed to clean up intermediate files`, error)
  }
}

export const runReverbTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: {
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    reverbVerbatimicity?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const version = 'v2'
  const segmentOffset = options.segmentOffsetMinutes || 0
  const segmentNumber = options.segmentNumber
  const totalSegments = options.totalSegments
  let preparedInput: Awaited<ReturnType<typeof prepareLocalSttInput>> | undefined
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'reverb', action: 'started', segmentNumber, totalSegments, model: version, detail: 'diarization' })
  } else {
    l.write('info', `Transcribing with Reverb ASR (diarization model: ${version})`)
  }
  try {
    const startTime = Date.now()
    const verbatimicity = options.reverbVerbatimicity ?? 0.5
    l.write('info', `Verbatimicity level: ${verbatimicity}`)
    const hasGpu = await detectGpuSupport()
    const device = hasGpu ? '0' : '-1'
    l.write('info', `Using device: ${hasGpu ? 'GPU' : 'CPU'}`)
    const uvEnvDir = reverbUvEnvDir
    const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
    const resultDir = `${outputDir}/reverb-output${segmentSuffix}`
    await Bun.$`mkdir -p ${resultDir}`.quiet()
    preparedInput = await prepareLocalSttInput(audioPath, 'autoshow-reverb-')
    const checkpointPath = `${reverbModelDir}/reverb_asr_v1.pt`
    const configPath = `${reverbModelDir}/config.yaml`
    const args = [
      'run', '-p', `${uvEnvDir}/bin/python`, '-m', 'wenet.bin.recognize_wav',
      '--config', `${configPath}`,
      '--checkpoint', `${checkpointPath}`,
      '--audio_file', preparedInput.audioPath,
      '--result_dir', resultDir,
      '--verbatimicity', verbatimicity.toString(),
      '--gpu', device
    ]
    const hfToken = getHuggingFaceToken()
    const result = await exec('uv', args)
    if (result.stderr) {
      const stderrLines = result.stderr.split('\n').filter((line: string) => line.trim())
      let hasError = false
      stderrLines.forEach((line: string) => {
        if (line.includes('ERROR') || line.includes('error') || line.includes('Error')) {
          l.error(`Reverb error: ${line}`)
          hasError = true
        } else if (line.includes('Traceback') || line.includes('File "')) {
          l.error(`Reverb traceback: ${line}`)
          hasError = true
        }
      })
      if (hasError && result.exitCode !== 0) {
        throw new Error(`Reverb transcription failed with errors`)
      }
    }
    if (result.stdout && result.stdout.includes('Traceback')) {
      l.error(`Python error detected in stdout`)
      const lines = result.stdout.split('\n')
      lines.forEach((line: string) => {
        if (line.trim()) l.error(`${line}`)
      })
      throw new Error('Reverb transcription failed with Python error')
    }
    if (result.exitCode !== 0) {
      l.error(`Reverb transcription failed with exit code ${result.exitCode}`)
      throw new Error(`Reverb transcription failed with exit code ${result.exitCode}`)
    }
    await waitForReverbResultFiles(resultDir)
    let transcription: TranscriptionResult
    let evidence: TranscriptionResult['evidence'] | undefined
    let ctmPath: string | null = null
    if (hfToken) {
      ctmPath = await findCTMFile(resultDir)
      if (ctmPath) {
        const rttmPath = await runDiarization(preparedInput.audioPath, hfToken, resultDir)
        if (rttmPath) {
          const jsonOutputPath = `${outputDir}/transcription${segmentSuffix}.json`
          const diarizedData = await mergeASRWithDiarization(ctmPath, rttmPath, jsonOutputPath)
          if (diarizedData && typeof diarizedData === 'object' && diarizedData !== null) {
            l.write('success', `Successfully performed speaker diarization with ${version}`)
            const rawSegments = Array.isArray((diarizedData as Record<string, unknown>)['segments'])
              ? (diarizedData as Record<string, unknown>)['segments'] as Array<Record<string, unknown>>
              : []
            const evidenceWords = rawSegments.flatMap((segment) => {
              const segmentSpeaker = typeof segment['speaker'] === 'string' && segment['speaker'] !== 'UNKNOWN'
                ? segment['speaker']
                : undefined
              const segmentWords = Array.isArray(segment['words']) ? segment['words'] : []
              return segmentWords.flatMap((word) => {
                if (typeof word !== 'object' || word === null) {
                  return []
                }

                const token = word as Record<string, unknown>
                if (typeof token['start'] !== 'number' || typeof token['end'] !== 'number' || typeof token['word'] !== 'string') {
                  return []
                }

                const text = token['word'].trim()
                if (text.length === 0) {
                  return []
                }

                return [{
                  startSeconds: token['start'],
                  endSeconds: token['end'],
                  text,
                  normalized: text.toLowerCase(),
                  ...(segmentSpeaker ? { speaker: segmentSpeaker } : {}),
                  timingSource: 'native' as const
                }]
              })
            })
            await Bun.$`rm -f ${jsonOutputPath}`.quiet()
            l.write('success', `Deleted intermediary JSON file: ${jsonOutputPath}`)
            transcription = parseReverbWithSpeakers(diarizedData, segmentOffset)
            evidence = {
              ...(evidenceWords.length > 0 ? { words: evidenceWords } : {}),
              capabilities: {
                hasNativeWordTiming: evidenceWords.length > 0,
                hasConfidence: false,
                hasSpeakerLabels: transcription.segments.some((segment) => segment.speaker !== undefined)
              },
              timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
              rawResponse: diarizedData
            }
          } else {
            const textContent = await findAndReadOutputFile(resultDir)
            if (!textContent) throw new Error('Reverb transcription produced no readable output')
            transcription = parseReverbTextOutput(textContent, segmentOffset)
          }
        } else {
          const textContent = await findAndReadOutputFile(resultDir)
          if (!textContent) throw new Error('Reverb transcription produced no readable output')
          transcription = parseReverbTextOutput(textContent, segmentOffset)
        }
      } else {
        const textContent = await findAndReadOutputFile(resultDir)
        if (!textContent) throw new Error('Reverb transcription produced no readable output')
        transcription = parseReverbTextOutput(textContent, segmentOffset)
      }
    } else {
      const textContent = await findAndReadOutputFile(resultDir)
      if (!textContent) throw new Error('Reverb transcription produced no readable output')
      transcription = parseReverbTextOutput(textContent, segmentOffset)
    }
    const processingTime = Date.now() - startTime
    const tokenCount = countTokens(transcription.text)
    const outputBase = `${outputDir}/transcription${segmentSuffix}`
    await Bun.write(`${outputBase}.txt`, formatTranscriptText(transcription.segments))
    await cleanupIntermediateFiles(resultDir)
    if (segmentNumber && totalSegments) {
      logSttSegmentLifecycle(l, { provider: 'reverb', action: 'completed', segmentNumber, totalSegments, model: version, processingTimeMs: processingTime })
    } else {
      logSttSegmentLifecycle(l, { provider: 'reverb', action: 'completed', model: version, processingTimeMs: processingTime })
    }
    l.write('info', `Saved transcript to ${outputBase}.txt`)
    l.write('info', `Total transcribed text length: ${transcription.text.length} characters`)
    const hasSpeakers = transcription.segments.some(seg => seg.speaker)
    if (hasSpeakers) {
      const speakerSet = new Set(transcription.segments.map(seg => seg.speaker).filter(s => s))
      l.write('success', `Identified ${speakerSet.size} speakers in transcription`)
    }
    const transcriptionModelDescriptor = `${checkpointPath} | ${configPath} | diarization:${version}`
    l.write('info', `Recording transcription model: ${transcriptionModelDescriptor}`)
    const metadata: Step2Metadata = {
      transcriptionService: 'reverb',
      transcriptionModel: transcriptionModelDescriptor,
      processingTime,
      tokenCount
    }
    return {
      result: {
        ...transcription,
        ...(evidence ? { evidence } : {})
      },
      metadata
    }
  } finally {
    await preparedInput?.cleanup()
  }
}
