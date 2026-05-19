import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { validateWhisperModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { ensureProviderReady } from '~/utils/bootstrap-broker'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { runWhisperTranscribe } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/run-whisper'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { writeBatchManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import { createHumanTable, logLocationsTable } from '~/utils/logger/human-table'
import { buildLyricsCues } from './cue-builder'
import { formatSrt, formatVtt, loadCaptionFile } from './captions'
import { getOutputRootAbsolute, joinOutputRoot } from '~/cli/commands/process-steps/output-root'
import {
  FIXED_RENDER_FPS,
  FIXED_RENDER_HEIGHT,
  FIXED_RENDER_WIDTH,
  buildAss,
  extractTitle,
  findMatchingImage,
  renderLyricsVideo
} from './render'
import type { CaptionCue, LyricsCueSource } from '~/types'

const PROJECT_ROOT = resolve(import.meta.dir, '../../../../../../')
const DEFAULT_INPUT_ROOT = join(PROJECT_ROOT, 'input')
const OUTPUT_ROOT = getOutputRootAbsolute(PROJECT_ROOT)

const logLyricsBatchSummary = (total: number, succeeded: number, failed: number): void => {
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
  const override = process.env['AUTOSHOW_MUSIC_LYRIC_VIDEO_INPUT_DIR']
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
    await writeRunManifest(outputDirAbsolute, 'music', {
      mode: 'lyric-video',
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
      logLocationsTable(l, [{
        artifact: 'musicLyricsVideo',
        path: `${outputDirRelative}/${videoFileName}`
      }])
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

export const runMusicLyricVideo = async (flags: Record<string, unknown>): Promise<void> => {
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
    const batchDirRelative = joinOutputRoot(createUniqueDirectoryName('music-lyrics-batch'))
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
        l.error(`Music lyric-video batch item failed: ${toProjectDisplayPath(audioPath)}`, error)
      }
    }

    await writeBatchManifest(batchDirAbsolute, 'music', items, {
      mode: 'lyric-video',
      inputDir: toProjectDisplayPath(inputRoot),
      model,
      font
    })

    logLocationsTable(l, [{ artifact: 'outputDir', path: batchDirRelative }])
    logLocationsTable(l, [{ artifact: 'batchManifest', path: `${batchDirRelative}/batch.json` }])
    logLyricsBatchSummary(items.length, succeeded, failed)

    if (failed > 0) {
      failWithExitCode(`Music lyric-video batch completed with ${failed} failed item(s)`, 1)
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
  const outputDirRelative = joinOutputRoot(createUniqueDirectoryName(`music-lyrics-${outputLabel}`))
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
