import { readdir, rm } from 'node:fs/promises'
import type { TranscriptionResult, Step2Metadata } from '~/types'
import * as l from '~/logger'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { parseReverbWithSpeakers, parseReverbTextOutput } from './parse-reverb-output'
import { exec } from '~/utils/cli-utils'
import { getHuggingFaceToken, runDiarization, mergeASRWithDiarization, findCTMFile } from './run-reverb-diarization'
import { reverbUvEnvDir, reverbModelDir } from '~/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup'
import { pollUntil } from '~/utils/retries'

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
        l.info(`GPU detected: ${stdout.trim()}`)
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
    l.info(`Cleaning up intermediate Reverb files`)
    const files = await listFilesRecursive(resultDir)
    const ctmFileList = files.filter(path => path.endsWith('.ctm'))
    for (const ctmFile of ctmFileList) {
      await rm(ctmFile, { force: true })
      l.info(`Deleted CTM file: ${ctmFile}`)
    }
    const rttmPath = `${resultDir}/diarization.rttm`
    const rttmExists = await Bun.file(rttmPath).exists()
    if (rttmExists) {
      await rm(rttmPath, { force: true })
      l.info(`Deleted RTTM file: ${rttmPath}`)
    }
    await rm(resultDir, { recursive: true, force: true })
    l.success(`Cleaned up intermediate directory: ${resultDir}`)
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
  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Reverb ASR (diarization model: ${version})`)
  } else {
    l.info(`Transcribing with Reverb ASR (diarization model: ${version})`)
  }
  const startTime = Date.now()
  const verbatimicity = options.reverbVerbatimicity ?? 0.5
  l.info(`Verbatimicity level: ${verbatimicity}`)
  const hasGpu = await detectGpuSupport()
  const device = hasGpu ? '0' : '-1'
  l.info(`Using device: ${hasGpu ? 'GPU' : 'CPU'}`)
  const uvEnvDir = reverbUvEnvDir
  const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
  const resultDir = `${outputDir}/reverb-output${segmentSuffix}`
  await Bun.$`mkdir -p ${resultDir}`.quiet()
  const checkpointPath = `${reverbModelDir}/reverb_asr_v1.pt`
  const configPath = `${reverbModelDir}/config.yaml`
  const args = [
    'run', '-p', `${uvEnvDir}/bin/python`, '-m', 'wenet.bin.recognize_wav',
    '--config', `${configPath}`,
    '--checkpoint', `${checkpointPath}`,
    '--audio_file', audioPath,
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
  let ctmPath: string | null = null
  if (hfToken) {
    ctmPath = await findCTMFile(resultDir)
    if (ctmPath) {
      const rttmPath = await runDiarization(audioPath, hfToken, resultDir)
      if (rttmPath) {
        const jsonOutputPath = `${outputDir}/transcription${segmentSuffix}.json`
        const diarizedData = await mergeASRWithDiarization(ctmPath, rttmPath, jsonOutputPath)
        if (diarizedData) {
          l.success(`Successfully performed speaker diarization with ${version}`)
          await Bun.$`rm -f ${jsonOutputPath}`.quiet()
          l.success(`Deleted intermediary JSON file: ${jsonOutputPath}`)
          transcription = parseReverbWithSpeakers(diarizedData, segmentOffset)
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
  const formattedTranscript = transcription.segments
    .map(seg => {
      const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : ''
      return `[${seg.start}] ${speakerPrefix}${seg.text}`
    })
    .join('\n')
  await Bun.write(`${outputBase}.txt`, formattedTranscript)
  await cleanupIntermediateFiles(resultDir)
  if (segmentNumber && totalSegments) {
    l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
  } else {
    l.success(`Reverb transcription completed in ${processingTime}ms`)
  }
  l.info(`Saved transcript to ${outputBase}.txt`)
  l.info(`Total transcribed text length: ${transcription.text.length} characters`)
  const hasSpeakers = transcription.segments.some(seg => seg.speaker)
  if (hasSpeakers) {
    const speakerSet = new Set(transcription.segments.map(seg => seg.speaker).filter(s => s))
    l.success(`Identified ${speakerSet.size} speakers in transcription`)
  }
  const transcriptionModelDescriptor = `${checkpointPath} | ${configPath} | diarization:${version}`
  l.info(`Recording transcription model: ${transcriptionModelDescriptor}`)
  const metadata: Step2Metadata = {
    transcriptionService: 'reverb',
    transcriptionModel: transcriptionModelDescriptor,
    transcriptionModelName: 'reverb',
    processingTime,
    tokenCount
  }
  return { result: transcription, metadata }
}
