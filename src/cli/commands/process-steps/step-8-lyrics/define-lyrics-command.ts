import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { defineCommand } from 'clerc'
import { lyricsFlags } from '~/cli/flags'
import { validateWhisperModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { ensureProviderReady } from '~/features/bootstrap-broker'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { buildExpectedFilesList } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { runWhisperTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-local/whisper/run-whisper'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { readRunManifest, writeBatchManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { runTextWrite } from '~/cli/commands/process-steps/step-3-write/run-text-write'
import {
  collectTextInputFiles,
  loadTrackTitles,
  readPromptFileText
} from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { resolveMaxCentsFromFlags } from '~/cli/commands/process-steps/generation-command-utils'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import * as l from '~/logger'
import { createHumanTable } from '~/logger/human-table'
import { buildLyricsCues } from './cue-builder'
import { formatSrt, formatVtt, loadCaptionFile } from './captions'
import {
  FIXED_RENDER_FPS,
  FIXED_RENDER_HEIGHT,
  FIXED_RENDER_WIDTH,
  buildAss,
  extractTitle,
  findMatchingImage,
  renderLyricsVideo
} from './render'
import type { CaptionCue, LyricsCueSource } from './lyrics-types'
import type { BatchChildRunContext, RuntimeOptions } from '~/types'

const PROJECT_ROOT = resolve(import.meta.dir, '../../../../../')
const DEFAULT_INPUT_ROOT = join(PROJECT_ROOT, 'input')
const OUTPUT_ROOT = join(PROJECT_ROOT, 'output')

const logLyricsBatchSummary = (total: number, succeeded: number, failed: number): void => {
  l.info(`Batch summary: total=${total}, succeeded=${succeeded}, failed=${failed}`)
  l.write(failed > 0 ? 'warn' : 'success', 'Batch Summary', {
    category: 'pipeline',
    humanTable: createHumanTable([{
      total,
      succeeded,
      failed
    }], ['total', 'succeeded', 'failed'])
  })
}
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'])

const resolveInputRoot = (): string => {
  const override = process.env['AUTOSHOW_LYRICS_INPUT_DIR']
  return override ? resolve(PROJECT_ROOT, override) : DEFAULT_INPUT_ROOT
}

const resolveUserPath = (value: string): string =>
  resolve(PROJECT_ROOT, value)

const toPosixPath = (value: string): string =>
  value.replace(/\\/g, '/')

const toProjectDisplayPath = (absolutePath: string): string => {
  const rel = relative(PROJECT_ROOT, absolutePath)
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) {
    return absolutePath
  }

  return toPosixPath(rel)
}

const isWithinDir = (targetPath: string, directory: string): boolean => {
  const rel = relative(directory, targetPath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const ensureRepoPath = (flag: '--audio' | '--captions', filePath: string, requiredDir: string): void => {
  if (!isWithinDir(filePath, requiredDir)) {
    throw CLIUsageError(`${flag} must point to a file inside ./${toPosixPath(relative(PROJECT_ROOT, requiredDir))}`)
  }
}

const baseStem = (filePath: string): string =>
  basename(filePath, extname(filePath))

const findAudioFiles = async (inputDir: string): Promise<string[]> => {
  if (!await fileExists(inputDir)) {
    throw new Error(`Input directory not found: ${toProjectDisplayPath(inputDir)}`)
  }

  const discovered: string[] = []

  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      const extension = extname(entry.name).toLowerCase()
      if (AUDIO_EXTENSIONS.has(extension)) {
        discovered.push(fullPath)
      }
    }
  }

  await walk(inputDir)
  discovered.sort((left, right) => {
    const byBase = basename(left).localeCompare(basename(right), undefined, { numeric: true, sensitivity: 'base' })
    return byBase !== 0 ? byBase : left.localeCompare(right)
  })
  return discovered
}

type LyricsGenerationContext = {
  albumDir: string
  textDir: string
  lyricsDir: string
  promptFilePath: string
  trackListPath?: string | undefined
}

const pathExistsAsDirectory = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

const pathExistsAsFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

const resolveLyricsGenerationContext = async (
  albumOrDir: string,
  promptFileFlag: string | undefined,
  trackListFlag: string | undefined
): Promise<LyricsGenerationContext> => {
  const directCandidate = resolveUserPath(albumOrDir)
  const fallbackAlbumDir = join(PROJECT_ROOT, 'albums', albumOrDir)

  let albumDir: string | undefined

  if (await fileExists(directCandidate)) {
    if (!await pathExistsAsDirectory(directCandidate)) {
      throw CLIUsageError(`Generation input must be a directory: ${toProjectDisplayPath(directCandidate)}`)
    }
    albumDir = directCandidate
  } else if (await pathExistsAsDirectory(fallbackAlbumDir)) {
    albumDir = fallbackAlbumDir
  }

  if (!albumDir) {
    throw CLIUsageError(
      `Lyrics generation directory not found: ${albumOrDir}. Tried ${toProjectDisplayPath(directCandidate)} and ${toProjectDisplayPath(fallbackAlbumDir)}`
    )
  }

  const textDir = join(albumDir, 'text')
  if (!await pathExistsAsDirectory(textDir)) {
    throw CLIUsageError(`Lyrics generation requires a text/ directory at ${toProjectDisplayPath(textDir)}`)
  }

  const promptFilePath = promptFileFlag ? resolveUserPath(promptFileFlag) : join(albumDir, 'prompt.md')
  if (!await pathExistsAsFile(promptFilePath)) {
    throw CLIUsageError(`Lyrics generation requires prompt.md at ${toProjectDisplayPath(promptFilePath)}`)
  }

  const autoTrackListPath = join(albumDir, 'tracks.md')
  const trackListPath = trackListFlag
    ? resolveUserPath(trackListFlag)
    : await pathExistsAsFile(autoTrackListPath)
      ? autoTrackListPath
      : undefined

  const lyricsDir = join(albumDir, 'lyrics')
  await ensureDirectory(lyricsDir)

  await readPromptFileText(promptFilePath)
  if (trackListPath) {
    await loadTrackTitles(trackListPath)
  }

  return {
    albumDir,
    textDir,
    lyricsDir,
    promptFilePath,
    ...(trackListPath ? { trackListPath } : {})
  }
}

const resolveLyricsGenerationFiles = async (
  textDir: string,
  fileArg: string | undefined
): Promise<string[]> => {
  const files = await collectTextInputFiles(textDir)
  if (files.length === 0) {
    throw CLIUsageError(`No .md or .txt files found in ${toProjectDisplayPath(textDir)}`)
  }

  if (!fileArg) {
    return files
  }

  const normalizedArg = toPosixPath(fileArg.replace(/^\.\/+/, ''))
  const exactMatches = files.filter((filePath) => {
    const relativePath = toPosixPath(relative(textDir, filePath))
    return relativePath === normalizedArg || basename(filePath) === normalizedArg
  })
  if (exactMatches.length === 1) {
    return exactMatches
  }
  if (exactMatches.length > 1) {
    throw CLIUsageError(
      `Lyrics generation file "${fileArg}" is ambiguous inside ${toProjectDisplayPath(textDir)}`
    )
  }

  const extension = extname(normalizedArg).toLowerCase()
  if (extension === '.md' || extension === '.txt') {
    throw CLIUsageError(`Lyrics generation file not found: ${fileArg}`)
  }

  const stemMatches = files.filter((filePath) => {
    const relativePath = toPosixPath(relative(textDir, filePath))
    const relativeStem = relativePath.slice(0, -extname(relativePath).length)
    return relativeStem === normalizedArg || baseStem(filePath) === normalizedArg
  })
  if (stemMatches.length === 1) {
    return stemMatches
  }
  if (stemMatches.length > 1) {
    throw CLIUsageError(
      `Lyrics generation file "${fileArg}" is ambiguous inside ${toProjectDisplayPath(textDir)}`
    )
  }

  throw CLIUsageError(`Lyrics generation file not found: ${fileArg}`)
}

const getExplicitFlagNames = (): Set<string> => {
  const explicit = new Set<string>()

  for (const token of Bun.argv.slice(2)) {
    if (!token.startsWith('--')) {
      continue
    }

    const normalized = token.slice(2).split('=')[0]
    if (normalized) {
      explicit.add(normalized)
    }
  }

  return explicit
}

const getLyricsStep3ResultCount = async (outputDir: string): Promise<number> => {
  const manifest = await readRunManifest(outputDir, 'write')
  if (!manifest) {
    return 0
  }

  const step3 = manifest.metadata['step3']
  if (Array.isArray(step3)) {
    return step3.length
  }

  const asRecord = step3 as Record<string, unknown> | undefined
  return asRecord ? 1 : 0
}

const countRequestedTargets = (options: RuntimeOptions): number => {
  const llmTargets = [
    ...(options.openaiModels ?? []),
    ...(options.groqModels ?? []),
    ...(options.geminiModels ?? []),
    ...(options.anthropicModels ?? []),
    ...(options.minimaxModels ?? []),
    ...(options.grokModels ?? []),
    ...(options.llamaModels ?? [])
  ]

  return llmTargets.length > 0 ? llmTargets.length : 1
}

const buildLyricsGenerationOptions = (
  flags: Record<string, unknown>,
  promptFilePath: string,
  lyricsDir: string,
  trackListPath?: string
): RuntimeOptions => {
  const options = buildOptsFromFlags(
    false,
    flags,
    [],
    {},
    new Set(),
    Bun.argv.slice(2)
  )

  return {
    ...options,
    textInput: true,
    promptFile: promptFilePath,
    renderedOutDir: lyricsDir,
    ...(trackListPath ? { trackList: trackListPath } : { trackList: undefined })
  }
}

const reportLyricsGenerationExpectedOutput = async (
  outputDir: string,
  options: RuntimeOptions,
  sampleInputPath: string,
  extraFiles: string[] = []
): Promise<void> => {
  const expectedFiles = await buildExpectedFilesList('write', options, sampleInputPath)
  l.report.expectedOutput(outputDir, [...extraFiles, ...expectedFiles])
}

const reportLyricsGenerationSuiteEstimate = async (
  files: string[],
  options: RuntimeOptions
): Promise<number> => {
  l.info(`Calculating suite price estimate across ${files.length} lyric source file(s)`)

  let suiteTotalEstimatedCost = 0
  for (const [index, filePath] of files.entries()) {
    l.info(`Price check ${index + 1}/${files.length}: ${toProjectDisplayPath(filePath)}`)
    const estimate = await buildAggregatedPriceEstimate('write', filePath, options, undefined)
    l.report.estimate(estimate)
    suiteTotalEstimatedCost += estimate.totalEstimatedCost
  }

  l.info('')
  l.info('Suite Cost Summary')
  l.info(`  Files checked: ${files.length}`)
  l.info(`  Suite total estimated cost: ${suiteTotalEstimatedCost.toFixed(5)}¢`)

  return suiteTotalEstimatedCost
}

const isRetryableLlamaWarmupFailure = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('No response from llama.cpp model')

const runLyricsGenerationWrite = async (
  inputPath: string,
  options: RuntimeOptions,
  batchChildContext?: BatchChildRunContext
): Promise<Awaited<ReturnType<typeof runTextWrite>>> => {
  try {
    return await runTextWrite(inputPath, './output', options, batchChildContext)
  } catch (error) {
    if (!isRetryableLlamaWarmupFailure(error)) {
      throw error
    }

    l.warn(`Retrying lyric generation after llama.cpp warmup failure: ${toProjectDisplayPath(inputPath)}`)
    return await runTextWrite(inputPath, './output', options, batchChildContext)
  }
}

const writeCaptionArtifacts = async (outputDir: string, stem: string, cues: CaptionCue[]): Promise<void> => {
  await Promise.all([
    Bun.write(join(outputDir, `${stem}.vtt`), formatVtt(cues)),
    Bun.write(join(outputDir, `${stem}.srt`), formatSrt(cues))
  ])
}

const processLyricsRun = async (options: {
  audioPath: string
  outputDirAbsolute: string
  outputDirRelative: string
  font: string
  keepTmp: boolean
  model: string
  captionsPath?: string | undefined
  emitCompletion: boolean
}): Promise<{
  outputDir: string
  stem: string
  cueCount: number
  cueSource: LyricsCueSource
}> => {
  const {
    audioPath,
    outputDirAbsolute,
    outputDirRelative,
    font,
    keepTmp,
    model,
    captionsPath,
    emitCompletion
  } = options

  const startedAt = Date.now()
  const tempDir = join(outputDirAbsolute, '.lyrics-tmp')
  const assPath = join(tempDir, 'lyrics.ass')
  const renderedVideoPath = join(tempDir, 'out.mp4')
  const title = extractTitle(audioPath)
  const stem = captionsPath ? baseStem(captionsPath) : baseStem(audioPath)
  const videoFileName = `${stem}.mp4`
  const vttFileName = `${stem}.vtt`
  const srtFileName = `${stem}.srt`
  const videoPath = join(outputDirAbsolute, videoFileName)
  const imagePath = await findMatchingImage(audioPath, dirname(audioPath))

  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })

  let cues: CaptionCue[] = []
  let cueSource: LyricsCueSource = 'caption-file'
  let transcriptionMs = 0
  let transcriptionDescriptor: string | undefined

  try {
    if (captionsPath) {
      cues = await loadCaptionFile(captionsPath)
      if (cues.length === 0) {
        throw new Error(`Caption file contained no usable cues: ${toProjectDisplayPath(captionsPath)}`)
      }
    } else {
      await ensureProviderReady(`whisper:${model}`)
      const transcriptionStartedAt = Date.now()
      const whisperRun = await runWhisperTranscribe(audioPath, tempDir, {
        model,
        segmentOffsetMinutes: 0,
        preserveJson: keepTmp
      })
      transcriptionMs = Date.now() - transcriptionStartedAt
      transcriptionDescriptor = whisperRun.metadata.transcriptionModel
      const builtCues = buildLyricsCues(whisperRun.result)
      cues = builtCues.cues
      cueSource = builtCues.source
      if (cues.length === 0) {
        throw new Error('Whisper produced no usable lyric cues')
      }
    }

    const captionWriteStartedAt = Date.now()
    await writeCaptionArtifacts(outputDirAbsolute, stem, cues)
    const captionsWriteMs = Date.now() - captionWriteStartedAt

    await Bun.write(assPath, buildAss({
      width: FIXED_RENDER_WIDTH,
      height: FIXED_RENDER_HEIGHT,
      font,
      title
    }, cues))

    let backgroundRelativePath: string | undefined
    if (imagePath) {
      backgroundRelativePath = `background${extname(imagePath).toLowerCase()}`
      await copyFile(imagePath, join(tempDir, backgroundRelativePath))
    }

    const renderStartedAt = Date.now()
    const renderSummary = await renderLyricsVideo({
      audioPath,
      assRelativePath: 'lyrics.ass',
      outputRelativePath: 'out.mp4',
      width: FIXED_RENDER_WIDTH,
      height: FIXED_RENDER_HEIGHT,
      fps: FIXED_RENDER_FPS,
      workingDirectory: tempDir,
      cues,
      title,
      font,
      ...(backgroundRelativePath ? { imageRelativePath: backgroundRelativePath } : {})
    })
    const renderMs = Date.now() - renderStartedAt

    await copyFile(renderedVideoPath, videoPath)

    const totalMs = Date.now() - startedAt
    await writeRunManifest(outputDirAbsolute, 'lyrics', {
      source: {
        audioPath: toProjectDisplayPath(audioPath),
        ...(captionsPath ? { captionsPath: toProjectDisplayPath(captionsPath) } : {})
      },
      transcription: {
        mode: captionsPath ? 'captions' : 'whisper',
        ...(captionsPath ? {} : { model }),
        ...(transcriptionDescriptor ? { descriptor: transcriptionDescriptor } : {}),
        cueSource,
        cueCount: cues.length
      },
      render: {
        width: FIXED_RENDER_WIDTH,
        height: FIXED_RENDER_HEIGHT,
        fps: FIXED_RENDER_FPS,
        font,
        title,
        encoder: renderSummary.encoder,
        backgroundMode: renderSummary.backgroundMode,
        ...(imagePath ? { backgroundPath: toProjectDisplayPath(imagePath) } : {})
      },
      artifacts: {
        video: videoFileName,
        vtt: vttFileName,
        srt: srtFileName,
        run: 'run.json',
        tempDirKept: keepTmp
      },
      timing: {
        totalMs,
        transcriptionMs,
        captionsWriteMs,
        renderMs
      }
    })

    if (emitCompletion) {
      l.report.complete(outputDirRelative, {
        run: 'run.json',
        video: videoFileName,
        vtt: vttFileName,
        srt: srtFileName
      }, {
        metrics: {
          cueCount: cues.length,
          cueSource,
          background: imagePath ? 'image' : 'spectrogram',
          encoder: renderSummary.encoder
        }
      })
    } else {
      l.info(`Rendered lyrics: ${videoFileName}`)
    }

    return {
      outputDir: outputDirRelative,
      stem,
      cueCount: cues.length,
      cueSource
    }
  } finally {
    if (!keepTmp) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

const failWithExitCode = (message: string, exitCode: number): never => {
  const error = new Error(message) as Error & { exitCode?: number }
  error.exitCode = exitCode
  throw error
}

const GENERATION_ONLY_FLAGS = [
  'llama',
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'prompt',
  'prompt-file',
  'track-list',
  'price'
] as const

const RENDER_ONLY_FLAGS = [
  'audio',
  'captions',
  'batch',
  'model',
  'font',
  'keep-tmp'
] as const

const formatFlagList = (flags: string[]): string =>
  flags.map((flag) => `--${flag}`).join(', ')

const assertNoExplicitFlags = (
  explicitFlags: Set<string>,
  disallowed: readonly string[],
  errorBuilder: (flags: string[]) => string
): void => {
  const used = disallowed.filter((flag) => explicitFlags.has(flag))
  if (used.length > 0) {
    throw CLIUsageError(errorBuilder(used))
  }
}

const runLyricsRenderMode = async (flags: Record<string, unknown>): Promise<void> => {
  const inputRoot = resolveInputRoot()
  const outputRoot = OUTPUT_ROOT
  const batch = flags['batch'] === true
  const audioFlag = typeof flags['audio'] === 'string' ? flags['audio'] : undefined
  const captionsFlag = typeof flags['captions'] === 'string' ? flags['captions'] : undefined
  const modelRaw = typeof flags['model'] === 'string' ? flags['model'] : 'large-v3-turbo'
  const font = typeof flags['font'] === 'string' && flags['font'].trim().length > 0 ? flags['font'] : 'DejaVu Sans'
  const keepTmp = flags['keep-tmp'] === true

  if (batch) {
    if (audioFlag) {
      throw CLIUsageError('Do not use --audio with --batch')
    }
    if (captionsFlag) {
      throw CLIUsageError('Do not use --captions with --batch')
    }
  } else if (!audioFlag) {
    throw CLIUsageError('Missing --audio (or use --batch)')
  }

  const model = validateWhisperModel(modelRaw)

  if (batch) {
    const files = await findAudioFiles(inputRoot)
    if (files.length === 0) {
      throw new Error(`No audio files found in ${toProjectDisplayPath(inputRoot)}`)
    }

    await ensureDirectory(outputRoot)
    await ensureProviderReady(`whisper:${model}`)
    const batchDirRelative = `./output/${createUniqueDirectoryName('lyrics-batch')}`
    const batchDirAbsolute = resolve(PROJECT_ROOT, batchDirRelative)
    await ensureDirectory(batchDirAbsolute)

    const items: Array<Record<string, unknown>> = []
    let succeeded = 0
    let failed = 0

    for (const audioPath of files) {
      const label = baseStem(audioPath)
      const childDirAbsolute = await reserveBatchChildOutputDir({ batchDir: batchDirAbsolute }, {
        title: label,
        fallbackLabel: label
      }) ?? join(batchDirAbsolute, label)
      const childDirRelative = toProjectDisplayPath(childDirAbsolute)

      try {
        const result = await processLyricsRun({
          audioPath,
          outputDirAbsolute: childDirAbsolute,
          outputDirRelative: childDirRelative,
          font,
          keepTmp,
          model,
          emitCompletion: false
        })
        succeeded += 1
        items.push({
          inputAudioPath: toProjectDisplayPath(audioPath),
          outputDir: result.outputDir,
          status: 'completed',
          cueCount: result.cueCount,
          cueSource: result.cueSource
        })
      } catch (error) {
        failed += 1
        const message = error instanceof Error ? error.message : String(error)
        items.push({
          inputAudioPath: toProjectDisplayPath(audioPath),
          outputDir: childDirRelative,
          status: 'failed',
          error: message
        })
        l.error(`Lyrics batch item failed: ${toProjectDisplayPath(audioPath)}`, error)
      }
    }

    await writeBatchManifest(batchDirAbsolute, 'lyrics', items, {
      inputDir: toProjectDisplayPath(inputRoot),
      model,
      font
    })

    l.info(`Output directory: ${batchDirRelative}`)
    l.info(`Batch manifest: ${batchDirRelative}/batch.json`)
    logLyricsBatchSummary(items.length, succeeded, failed)

    if (failed > 0) {
      failWithExitCode(`Lyrics batch completed with ${failed} failed item(s)`, 1)
    }

    return
  }

  const audioPath = resolveUserPath(audioFlag!)
  const captionsPath = captionsFlag ? resolveUserPath(captionsFlag) : undefined
  ensureRepoPath('--audio', audioPath, inputRoot)
  if (captionsPath) {
    ensureRepoPath('--captions', captionsPath, outputRoot)
  }

  if (!await fileExists(audioPath)) {
    throw new Error(`Audio file not found: ${toProjectDisplayPath(audioPath)}`)
  }
  if (captionsPath && !await fileExists(captionsPath)) {
    throw new Error(`Caption file not found: ${toProjectDisplayPath(captionsPath)}`)
  }

  const outputLabel = captionsPath ? baseStem(captionsPath) : baseStem(audioPath)
  const outputDirRelative = `./output/${createUniqueDirectoryName(`lyrics-${outputLabel}`)}`
  const outputDirAbsolute = resolve(PROJECT_ROOT, outputDirRelative)
  await ensureDirectory(outputDirAbsolute)

  await processLyricsRun({
    audioPath,
    ...(captionsPath ? { captionsPath } : {}),
    outputDirAbsolute,
    outputDirRelative,
    font,
    keepTmp,
    model,
    emitCompletion: true
  })
}

const runLyricsGenerationMode = async (options: {
  albumOrDir: string
  fileArg: string | undefined
  flags: Record<string, unknown>
}): Promise<void> => {
  const { albumOrDir, fileArg, flags } = options
  const promptFileFlag = typeof flags['prompt-file'] === 'string' ? flags['prompt-file'] : undefined
  const trackListFlag = typeof flags['track-list'] === 'string' ? flags['track-list'] : undefined
  const context = await resolveLyricsGenerationContext(albumOrDir, promptFileFlag, trackListFlag)
  const files = await resolveLyricsGenerationFiles(context.textDir, fileArg)
  const generationOptions = buildLyricsGenerationOptions(
    flags,
    context.promptFilePath,
    context.lyricsDir,
    context.trackListPath
  )
  const maxCents = await resolveMaxCentsFromFlags(flags)

  if (files.length === 1) {
    const inputPath = files[0] as string
    const estimate = generationOptions.price || maxCents !== undefined
      ? await buildAggregatedPriceEstimate('write', inputPath, generationOptions, undefined)
      : undefined

    if (estimate) {
      l.report.estimate(estimate)
      if (generationOptions.price) {
        await reportLyricsGenerationExpectedOutput('./output/<timestamp>_<label>/', generationOptions, inputPath)
        return
      }

      if (maxCents !== undefined && estimate.totalEstimatedCost > maxCents) {
        if (!generationOptions.allowOverBudget) {
          throw CLIUsageError(
            `Estimated cost ${estimate.totalEstimatedCost.toFixed(4)}¢ exceeds configured budget ${maxCents.toFixed(4)}¢. Use --allow-over-budget to proceed.`
          )
        }
        l.warn(`Estimated cost ${estimate.totalEstimatedCost.toFixed(4)}¢ exceeds budget ${maxCents.toFixed(4)}¢ — continuing because --allow-over-budget is set.`)
      }
    }

    await runLyricsGenerationWrite(inputPath, generationOptions)
    return
  }

  if (generationOptions.price || maxCents !== undefined) {
    const suiteTotalEstimatedCost = await reportLyricsGenerationSuiteEstimate(files, generationOptions)
    if (generationOptions.price) {
      await reportLyricsGenerationExpectedOutput('./output/<timestamp>_lyrics-gen-batch/', generationOptions, files[0] as string, [
        'batch.json',
        '<child-run>/prompt.md',
        '<child-run>/text.json',
        '<child-run>/run.json'
      ])
      return
    }

    if (maxCents !== undefined && suiteTotalEstimatedCost > maxCents) {
      if (!generationOptions.allowOverBudget) {
        throw CLIUsageError(
          `Estimated suite cost ${suiteTotalEstimatedCost.toFixed(4)}¢ exceeds configured budget ${maxCents.toFixed(4)}¢. Use --allow-over-budget to proceed.`
        )
      }
      l.warn(`Estimated suite cost ${suiteTotalEstimatedCost.toFixed(4)}¢ exceeds budget ${maxCents.toFixed(4)}¢ — continuing because --allow-over-budget is set.`)
    }
  }

  await ensureDirectory(OUTPUT_ROOT)
  const batchDirRelative = `./output/${createUniqueDirectoryName('lyrics-gen-batch')}`
  const batchDirAbsolute = resolve(PROJECT_ROOT, batchDirRelative)
  await ensureDirectory(batchDirAbsolute)

  const items: Array<Record<string, unknown>> = []
  let succeeded = 0
  let failed = 0

  for (const inputPath of files) {
    const batchChildContext: BatchChildRunContext = { batchDir: batchDirAbsolute }

    try {
      const result = await runLyricsGenerationWrite(inputPath, generationOptions, batchChildContext)
      const generatedLyricFiles = await getLyricsStep3ResultCount(result.outputDir)
      succeeded += 1
      items.push({
        inputTextPath: toProjectDisplayPath(inputPath),
        outputDir: toProjectDisplayPath(result.outputDir),
        status: 'completed',
        generatedLyricFiles
      })
    } catch (error) {
      failed += 1
      const childDir = batchChildContext.outputDir
      const message = error instanceof Error ? error.message : String(error)
      items.push({
        inputTextPath: toProjectDisplayPath(inputPath),
        ...(childDir ? { outputDir: toProjectDisplayPath(childDir) } : {}),
        status: 'failed',
        error: message
      })
      l.error(`Lyrics generation batch item failed: ${toProjectDisplayPath(inputPath)}`, error)
    }
  }

  await writeBatchManifest(batchDirAbsolute, 'lyrics', items, {
    mode: 'generation',
    albumDir: toProjectDisplayPath(context.albumDir),
    textDir: toProjectDisplayPath(context.textDir),
    lyricsDir: toProjectDisplayPath(context.lyricsDir),
    promptFile: toProjectDisplayPath(context.promptFilePath),
    ...(context.trackListPath ? { trackList: toProjectDisplayPath(context.trackListPath) } : {}),
    requestedProviderCount: countRequestedTargets(generationOptions)
  })

  l.info(`Output directory: ${batchDirRelative}`)
  l.info(`Batch manifest: ${batchDirRelative}/batch.json`)
  logLyricsBatchSummary(items.length, succeeded, failed)

  if (failed > 0) {
    failWithExitCode(`Lyrics generation batch completed with ${failed} failed item(s)`, 1)
  }
}

export const lyricsCommand = defineCommand({
  name: 'lyrics',
  description: 'Render lyric videos from local audio or generate lyric drafts from album text',
  parameters: [
    { key: '[albumOrDir]', description: 'Album name under ./albums or a directory containing prompt.md and text/' },
    { key: '[file]', description: 'Optional source file inside text/ (with or without .md/.txt)' }
  ],
  flags: lyricsFlags,
  help: {
    examples: [
      ['bun as lyrics album-title', 'Generate lyric drafts from ./albums/album-title/text into ./albums/album-title/lyrics'],
      ['bun as lyrics ./albums/demo 01-track --openai gpt-5.4 --prompt rockSong', 'Generate one lyric draft with the existing LLM write pipeline'],
      ['bun as lyrics --audio input/examples/lyrics/01-example-song.mp3', 'Render a lyric video from local audio'],
      ['bun as lyrics --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt', 'Rerender from edited captions without rerunning Whisper'],
      ['bun as lyrics --batch --model small', 'Render lyric videos for every supported audio file under ./input']
    ]
  }
}, async (ctx) => {
  const flags = ctx.flags as Record<string, unknown>
  const albumOrDir = typeof ctx.parameters.albumOrDir === 'string' ? ctx.parameters.albumOrDir : undefined
  const fileArg = typeof ctx.parameters.file === 'string' ? ctx.parameters.file : undefined
  const explicitFlags = getExplicitFlagNames()

  if (albumOrDir) {
    assertNoExplicitFlags(
      explicitFlags,
      RENDER_ONLY_FLAGS,
      (used) => `lyrics generation mode does not support ${formatFlagList(used)}`
    )
    await runLyricsGenerationMode({ albumOrDir, fileArg, flags })
    return
  }

  if (fileArg) {
    throw CLIUsageError('lyrics generation requires an album or directory before the optional file name')
  }

  assertNoExplicitFlags(explicitFlags, GENERATION_ONLY_FLAGS, (used) => {
    if (used.length === 1 && used[0] === 'price') {
      return 'lyrics render mode does not support --price'
    }
    return `lyrics render mode does not support ${formatFlagList(used)}; use "bun as lyrics <album-or-dir> [file]" for lyric generation`
  })

  await runLyricsRenderMode(flags)
})
