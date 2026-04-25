import { mkdir, stat } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { probeMediaFile } from '~/cli/commands/process-steps/step-1-download/audio/audio-normalize'
import { sttTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt'
import * as l from '~/utils/logger'
import { sanitizeLogText } from '~/utils/logger/redaction'
import { generateCompressionVariant, generateSpeedVariant } from './audio-variants'
import { resolveAvailableServices, parseReferenceStt } from './benchmark-services'
import { computeWER } from './wer'
import type {
  AudioVariant,
  BenchmarkAttemptRecord,
  BenchmarkAttemptStatus,
  BenchmarkFlags,
  BenchmarkReport,
  BenchmarkScoreEntry,
  SttServiceSpec,
  VariantTranscription
} from './benchmark-types'

const WER_THRESHOLD = 0.10

const ensureDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
}

const summarizeVariant = (variant: AudioVariant): BenchmarkAttemptRecord['variant'] => ({
  kind: variant.kind,
  label: variant.label,
  bitrateKbps: variant.bitrateKbps,
  speedMultiplier: variant.speedMultiplier
})

export const buildBenchmarkAttemptRecord = (
  variant: AudioVariant,
  spec: SttServiceSpec,
  status: BenchmarkAttemptStatus,
  processingTimeMs?: number | undefined,
  error?: string | undefined
): BenchmarkAttemptRecord => ({
  kind: 'benchmark-attempt',
  schemaVersion: 1,
  status,
  variant: summarizeVariant(variant),
  service: spec.service,
  model: spec.model,
  ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
  ...(error !== undefined ? { error: sanitizeLogText(error) } : {})
})

const writeBenchmarkAttemptRecord = async (
  outDir: string,
  record: BenchmarkAttemptRecord
): Promise<void> => {
  await Bun.write(join(outDir, 'benchmark-attempt.json'), JSON.stringify(record, null, 2))
}

const formatTimestamp = (): string => {
  const now = new Date()
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

const prepareSourceAudio = async (
  inputPath: string,
  outputDir: string
): Promise<{ sourcePath: string, durationSeconds: number | undefined }> => {
  const absInput = resolve(inputPath)
  await stat(absInput)

  const probe = await probeMediaFile(absInput)
  const sourcePath = join(outputDir, 'source.m4a')

  l.write('info','Preparing source audio (high-quality m4a baseline)...')
  const { exitCode, stderr } = await exec('ffmpeg', [
    '-i', absInput,
    '-map', '0:a:0',
    '-vn',
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-c:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', '128000',
    '-ac', '1',
    '-f', 'ipod',
    '-y', sourcePath
  ])

  if (exitCode !== 0) {
    throw new Error(`Failed to prepare source audio: ${stderr}`)
  }

  return { sourcePath, durationSeconds: probe.durationSeconds }
}

const generateVariants = async (
  sourcePath: string,
  outputDir: string,
  bitrates: number[],
  speeds: number[],
  skipCompression: boolean,
  skipSpeed: boolean
): Promise<{ compressionVariants: AudioVariant[], speedVariants: AudioVariant[] }> => {
  const compressionVariants: AudioVariant[] = []
  const speedVariants: AudioVariant[] = []

  if (!skipCompression) {
    const compressionDir = join(outputDir, 'variants', 'compression')
    await ensureDir(compressionDir)
    l.write('info',`Generating ${bitrates.length} compression variants...`)
    for (const kbps of bitrates) {
      const outPath = join(compressionDir, `${kbps}k.m4a`)
      const variant = await generateCompressionVariant(sourcePath, outPath, kbps)
      compressionVariants.push(variant)
    }
  }

  if (!skipSpeed) {
    const speedDir = join(outputDir, 'variants', 'speed')
    await ensureDir(speedDir)
    l.write('info',`Generating ${speeds.length} speed variants...`)
    for (const speed of speeds) {
      const outPath = join(speedDir, `${speed}x.m4a`)
      const variant = await generateSpeedVariant(sourcePath, outPath, speed)
      speedVariants.push(variant)
    }
  }

  return { compressionVariants, speedVariants }
}

const transcribeVariant = async (
  variant: AudioVariant,
  spec: SttServiceSpec,
  transcriptionDir: string,
  durationSeconds: number | undefined
): Promise<VariantTranscription> => {
  const outDir = join(transcriptionDir, variant.label, `${spec.service}-${spec.model}`)
  await ensureDir(outDir)

  const start = Date.now()
  await writeBenchmarkAttemptRecord(outDir, buildBenchmarkAttemptRecord(variant, spec, 'started'))
  try {
    const { result } = await sttTarget(variant.path, outDir, {
      service: spec.service,
      model: spec.model,
      local: spec.service === 'whisper' || spec.service === 'reverb'
    }, {
      audioDurationSeconds: durationSeconds
    })
    const processingTimeMs = Date.now() - start
    await writeBenchmarkAttemptRecord(outDir, buildBenchmarkAttemptRecord(variant, spec, 'success', processingTimeMs))

    return {
      variant,
      service: spec.service,
      model: spec.model,
      text: result.text,
      processingTimeMs
    }
  } catch (error) {
    const message = sanitizeLogText(error instanceof Error ? error.message : String(error))
    const processingTimeMs = Date.now() - start
    await writeBenchmarkAttemptRecord(outDir, buildBenchmarkAttemptRecord(variant, spec, 'error', processingTimeMs, message))
    l.warn(`  ${spec.service}:${spec.model} failed on ${variant.label}: ${message}`)
    return {
      variant,
      service: spec.service,
      model: spec.model,
      text: '',
      processingTimeMs,
      error: message
    }
  }
}

const computeSummary = (
  compressionResults: BenchmarkScoreEntry[],
  speedResults: BenchmarkScoreEntry[]
): BenchmarkReport['summary'] => {
  const allResults = [...compressionResults, ...speedResults].filter(r => !r.error)

  const serviceGroups = new Map<string, BenchmarkScoreEntry[]>()
  for (const entry of allResults) {
    const key = `${entry.service}:${entry.model}`
    const group = serviceGroups.get(key) ?? []
    group.push(entry)
    serviceGroups.set(key, group)
  }

  const serviceRankings = [...serviceGroups.entries()]
    .map(([key, entries]) => {
      const [service, model] = key.split(':')
      const averageWer = entries.reduce((sum, e) => sum + e.wer, 0) / entries.length
      return { service: service!, model: model!, averageWer: Math.round(averageWer * 10000) / 10000 }
    })
    .sort((a, b) => a.averageWer - b.averageWer)

  let bestCompressionThreshold: BenchmarkReport['summary']['bestCompressionThreshold'] = null
  const compressionByService = new Map<string, BenchmarkScoreEntry[]>()
  for (const entry of compressionResults.filter(r => !r.error)) {
    const key = `${entry.service}:${entry.model}`
    const group = compressionByService.get(key) ?? []
    group.push(entry)
    compressionByService.set(key, group)
  }

  for (const [key, entries] of compressionByService) {
    const sorted = entries.sort((a, b) => (a.variant.bitrateKbps ?? 0) - (b.variant.bitrateKbps ?? 0))
    for (const entry of sorted) {
      if (entry.wer <= WER_THRESHOLD) {
        const [service, model] = key.split(':')
        if (
          !bestCompressionThreshold ||
          (entry.variant.bitrateKbps ?? 0) < bestCompressionThreshold.minBitrateKbps
        ) {
          bestCompressionThreshold = {
            service: service!,
            model: model!,
            minBitrateKbps: entry.variant.bitrateKbps ?? 0,
            werAtThreshold: Math.round(entry.wer * 10000) / 10000
          }
        }
        break
      }
    }
  }

  let bestSpeedThreshold: BenchmarkReport['summary']['bestSpeedThreshold'] = null
  const speedByService = new Map<string, BenchmarkScoreEntry[]>()
  for (const entry of speedResults.filter(r => !r.error)) {
    const key = `${entry.service}:${entry.model}`
    const group = speedByService.get(key) ?? []
    group.push(entry)
    speedByService.set(key, group)
  }

  for (const [key, entries] of speedByService) {
    const sorted = entries.sort((a, b) => (b.variant.speedMultiplier ?? 0) - (a.variant.speedMultiplier ?? 0))
    for (const entry of sorted) {
      if (entry.wer <= WER_THRESHOLD) {
        const [service, model] = key.split(':')
        if (
          !bestSpeedThreshold ||
          (entry.variant.speedMultiplier ?? 0) > bestSpeedThreshold.maxSpeed
        ) {
          bestSpeedThreshold = {
            service: service!,
            model: model!,
            maxSpeed: entry.variant.speedMultiplier ?? 0,
            werAtThreshold: Math.round(entry.wer * 10000) / 10000
          }
        }
        break
      }
    }
  }

  return { bestCompressionThreshold, bestSpeedThreshold, serviceRankings }
}

export const runBenchmark = async (
  input: string | undefined,
  flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw new Error('Input audio file path is required. Usage: bun as benchmark <audio-file>')
  }

  const bitrates = flags.bitrates.split(',').map(s => Number.parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n))
  const speeds = flags.speeds.split(',').map(s => Number.parseFloat(s.trim())).filter(n => !Number.isNaN(n))

  const timestamp = formatTimestamp()
  const outputDir = flags['output-dir']
    ? resolve(flags['output-dir'])
    : resolve('output', 'benchmark', timestamp)
  await ensureDir(outputDir)

  l.write('info',`Benchmark output: ${outputDir}`)

  // Phase 1: Prepare source audio
  l.write('info','\n--- Phase 1: Prepare Source Audio ---')
  const { sourcePath, durationSeconds } = await prepareSourceAudio(input, outputDir)
  l.write('info',`Source ready: ${sourcePath}`)

  // Phase 2: Generate variants
  l.write('info','\n--- Phase 2: Generate Audio Variants ---')
  const { compressionVariants, speedVariants } = await generateVariants(
    sourcePath, outputDir, bitrates, speeds,
    flags['skip-compression'], flags['skip-speed']
  )
  const allVariants = [...compressionVariants, ...speedVariants]
  l.write('info',`Generated ${allVariants.length} variants (${compressionVariants.length} compression, ${speedVariants.length} speed)`)

  // Phase 3: Resolve available services and get reference transcription
  l.write('info','\n--- Phase 3: Reference Transcription ---')
  const ref = parseReferenceStt(flags['reference-stt'])
  const refSpec: SttServiceSpec = { service: ref.service, model: ref.model, envVar: undefined }

  l.write('info',`Transcribing source with reference: ${ref.service}:${ref.model}`)
  const transcriptionDir = join(outputDir, 'transcriptions')
  await ensureDir(transcriptionDir)

  const refResult = await transcribeVariant(
    { path: sourcePath, kind: 'compression', label: 'source' },
    refSpec,
    transcriptionDir,
    durationSeconds
  )

  if (refResult.error) {
    throw new Error(`Reference transcription failed: ${refResult.error}`)
  }

  const referenceText = refResult.text
  const refWordCount = referenceText.split(/\s+/).filter(Boolean).length
  l.write('info',`Reference transcription: ${refWordCount} words`)

  // Phase 4: Transcribe all variants through all services
  l.write('info','\n--- Phase 4: Transcribe Variants ---')
  const services = resolveAvailableServices(flags['stt-services'])
  l.write('info',`Testing ${services.length} service/model combinations across ${allVariants.length} variants`)
  l.write('info',`Services: ${[...new Set(services.map(s => s.service))].join(', ')}`)

  const transcriptions: VariantTranscription[] = []
  for (const variant of allVariants) {
    l.write('info',`\nTranscribing variant: ${variant.label}`)
    for (const spec of services) {
      l.write('info',`  ${spec.service}:${spec.model}...`)
      const result = await transcribeVariant(variant, spec, transcriptionDir, durationSeconds)
      transcriptions.push(result)
      if (!result.error) {
        const wer = computeWER(referenceText, result.text)
        l.write('info',`    WER: ${(wer.wer * 100).toFixed(1)}%`)
      }
    }
  }

  // Phase 5: Compute WER scores
  l.write('info','\n--- Phase 5: Compute Quality Scores ---')
  const toScoreEntry = (t: VariantTranscription): BenchmarkScoreEntry => {
    if (t.error) {
      return {
        variant: { kind: t.variant.kind, label: t.variant.label, bitrateKbps: t.variant.bitrateKbps, speedMultiplier: t.variant.speedMultiplier },
        service: t.service,
        model: t.model,
        wer: -1,
        substitutions: 0,
        deletions: 0,
        insertions: 0,
        referenceWordCount: refWordCount,
        processingTimeMs: t.processingTimeMs,
        error: t.error
      }
    }
    const wer = computeWER(referenceText, t.text)
    return {
      variant: { kind: t.variant.kind, label: t.variant.label, bitrateKbps: t.variant.bitrateKbps, speedMultiplier: t.variant.speedMultiplier },
      service: t.service,
      model: t.model,
      ...wer,
      processingTimeMs: t.processingTimeMs
    }
  }

  const compressionResults = transcriptions
    .filter(t => t.variant.kind === 'compression')
    .map(toScoreEntry)

  const speedResults = transcriptions
    .filter(t => t.variant.kind === 'speed')
    .map(toScoreEntry)

  // Phase 6: Generate report
  l.write('info','\n--- Phase 6: Generate Report ---')
  const summary = computeSummary(compressionResults, speedResults)

  const report: BenchmarkReport = {
    timestamp,
    sourceAudio: basename(input),
    referenceService: ref.service,
    referenceModel: ref.model,
    referenceWordCount: refWordCount,
    variants: allVariants.map(summarizeVariant),
    services: services.map(({ service, model }) => ({ service, model })),
    attempts: {
      total: transcriptions.length,
      succeeded: transcriptions.filter(t => !t.error).length,
      failed: transcriptions.filter(t => t.error).length
    },
    errors: transcriptions
      .filter((t): t is VariantTranscription & { error: string } => t.error !== undefined)
      .map(t => ({
        variant: summarizeVariant(t.variant),
        service: t.service,
        model: t.model,
        processingTimeMs: t.processingTimeMs,
        error: t.error
      })),
    compressionResults,
    speedResults,
    summary
  }

  const reportPath = join(outputDir, 'report.json')
  await Bun.write(reportPath, JSON.stringify(report, null, 2))
  l.write('info',`Report written to: ${reportPath}`)

  // Print summary
  l.write('info','\n=== Benchmark Summary ===')
  l.write('info',`Total variants tested: ${allVariants.length}`)
  l.write('info',`Total transcriptions: ${transcriptions.length}`)
  l.write('info',`Errors: ${transcriptions.filter(t => t.error).length}`)

  if (summary.bestCompressionThreshold) {
    l.write('info',`\nBest compression threshold: ${summary.bestCompressionThreshold.minBitrateKbps}kbps`)
    l.write('info',`  Service: ${summary.bestCompressionThreshold.service}:${summary.bestCompressionThreshold.model}`)
    l.write('info',`  WER at threshold: ${(summary.bestCompressionThreshold.werAtThreshold * 100).toFixed(1)}%`)
  }

  if (summary.bestSpeedThreshold) {
    l.write('info',`\nBest speed threshold: ${summary.bestSpeedThreshold.maxSpeed}x`)
    l.write('info',`  Service: ${summary.bestSpeedThreshold.service}:${summary.bestSpeedThreshold.model}`)
    l.write('info',`  WER at threshold: ${(summary.bestSpeedThreshold.werAtThreshold * 100).toFixed(1)}%`)
  }

  l.write('info','\nService rankings (by average WER):')
  for (const ranking of summary.serviceRankings.slice(0, 10)) {
    l.write('info',`  ${ranking.service}:${ranking.model} — ${(ranking.averageWer * 100).toFixed(1)}%`)
  }
}
