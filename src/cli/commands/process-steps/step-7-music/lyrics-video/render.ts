import { extname, join } from 'node:path'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { commandExists, exec } from '~/utils/cli-utils'
import type { CaptionCue, LyricsRenderSummary } from '~/types'
import type { OverlaySegment } from '~/types'

export const FIXED_RENDER_WIDTH = 1920
export const FIXED_RENDER_HEIGHT = 1080
export const FIXED_RENDER_FPS = 30

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'] as const

let encoderPromise: Promise<string> | undefined
let ffmpegFiltersPromise: Promise<string> | undefined

const escapeAssText = (text: string): string =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N')

export const extractTitle = (audioPath: string): string => {
  const baseName = audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? audioPath
  const match = baseName.match(/^(\d+)[-\s.]+(.+)$/)
  return match ? `${match[1]} - ${match[2]}` : baseName
}

export const assTime = (seconds: number): string => {
  const clamped = Math.max(0, seconds)
  const totalCentiseconds = Math.round(clamped * 100)
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const secs = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

export const buildAss = (
  options: { width: number, height: number, font: string, title: string },
  cues: CaptionCue[]
): string => {
  const { width, height, font, title } = options
  const horizontalMargin = Math.round(width * 0.1)
  const verticalMargin = Math.round(height * 0.1)
  const baseFontSize = Math.round(height * 0.045)
  const contextFontSize = Math.round(baseFontSize * 0.85)
  const titleFontSize = Math.round(baseFontSize * 0.9)
  const activeOutline = Math.max(3, Math.round(baseFontSize * 0.08))
  const activeShadow = Math.max(2, Math.round(baseFontSize * 0.04))
  const contextOutline = Math.max(2, Math.round(contextFontSize * 0.08))
  const contextShadow = Math.max(1, Math.round(contextFontSize * 0.04))
  const titleOutline = Math.max(2, Math.round(titleFontSize * 0.08))
  const titleShadow = Math.max(1, Math.round(titleFontSize * 0.04))

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Active,${font},${baseFontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,0,0,1,${activeOutline},${activeShadow},5,${horizontalMargin},${horizontalMargin},${verticalMargin},1`,
    `Style: Context,${font},${contextFontSize},&H00C0C0C0,&H00C0C0C0,&H00000000,&HA0000000,0,0,0,0,100,100,0,0,1,${contextOutline},${contextShadow},5,${horizontalMargin},${horizontalMargin},${verticalMargin},1`,
    `Style: Title,${font},${titleFontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,0,0,1,${titleOutline},${titleShadow},8,${horizontalMargin},${horizontalMargin},${verticalMargin},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ].join('\n')

  const events: string[] = []
  if (cues.length > 0) {
    const videoEnd = cues[cues.length - 1]!.end + 2
    const titleY = Math.round(height * 0.08)
    events.push(`Dialogue: 3,${assTime(0)},${assTime(videoEnd)},Title,,0,0,0,,{\\pos(${width / 2},${titleY})\\an5\\blur0.6\\q2}${escapeAssText(title)}`)
  }

  const lineSpacing = Math.round(height * 0.08)
  const centerY = Math.round(height / 2)
  const previousY = centerY - lineSpacing
  const nextY = centerY + lineSpacing

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!
    if (cue.end <= cue.start) {
      continue
    }

    if (index > 0) {
      events.push(`Dialogue: 1,${assTime(cue.start)},${assTime(cue.end)},Context,,0,0,0,,{\\pos(${width / 2},${previousY})\\an5\\blur0.6\\q2}${escapeAssText(cues[index - 1]!.text)}`)
    }

    events.push(`Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Active,,0,0,0,,{\\pos(${width / 2},${centerY})\\an5\\blur0.6\\q2}${escapeAssText(cue.text)}`)

    if (index + 1 < cues.length) {
      events.push(`Dialogue: 2,${assTime(cue.start)},${assTime(cue.end)},Context,,0,0,0,,{\\pos(${width / 2},${nextY})\\an5\\blur0.6\\q2}${escapeAssText(cues[index + 1]!.text)}`)
    }
  }

  return `${header}\n${events.join('\n')}\n`
}

const checkFfmpegEncoder = async (encoder: string): Promise<boolean> => {
  const result = await exec('ffmpeg', ['-hide_banner', '-encoders'])
  return result.exitCode === 0 && result.stdout.includes(encoder)
}

const readFfmpegFilters = async (): Promise<string> => {
  if (!ffmpegFiltersPromise) {
    ffmpegFiltersPromise = exec('ffmpeg', ['-hide_banner', '-filters']).then((result) => result.stdout)
  }

  return await ffmpegFiltersPromise
}

const hasFfmpegFilter = async (filterName: string): Promise<boolean> => {
  const filters = await readFfmpegFilters()
  return filters.split('\n').some((line) => line.trim().split(/\s+/).includes(filterName))
}

export const detectLyricsEncoder = async (): Promise<string> => {
  if (!encoderPromise) {
    encoderPromise = (async () => {
      if (process.platform === 'darwin' && await checkFfmpegEncoder('h264_videotoolbox')) {
        return 'h264_videotoolbox'
      }
      if (await checkFfmpegEncoder('h264_nvenc')) {
        return 'h264_nvenc'
      }
      if (await checkFfmpegEncoder('h264_amf')) {
        return 'h264_amf'
      }
      return 'libx264'
    })()
  }

  return await encoderPromise
}

const getEncoderSettings = (encoder: string): string[] => {
  switch (encoder) {
    case 'h264_videotoolbox':
      return ['-c:v', 'h264_videotoolbox', '-b:v', '8M', '-profile:v', 'high', '-allow_sw', '1', '-movflags', '+faststart']
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23', '-b:v', '0', '-profile:v', 'high', '-movflags', '+faststart']
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '23', '-movflags', '+faststart']
    default:
      return ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-tune', 'stillimage', '-threads', '0', '-movflags', '+faststart']
  }
}

export const findMatchingImage = async (audioPath: string, directory: string): Promise<string | undefined> => {
  const baseName = audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? ''
  for (const extension of IMAGE_EXTENSIONS) {
    const candidate = join(directory, `${baseName}${extension}`)
    if (await Bun.file(candidate).exists()) {
      return candidate
    }
  }

  const trackMatch = baseName.match(/^(\d+)[\s\-_.]/)
  if (!trackMatch) {
    return undefined
  }

  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const extension = extname(entry.name).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(extension as typeof IMAGE_EXTENSIONS[number])) {
      continue
    }

    const entryMatch = entry.name.match(/^(\d+)[\s\-_.]/)
    if (entryMatch?.[1] === trackMatch[1]) {
      return join(directory, entry.name)
    }
  }

  return undefined
}

const buildOverlaySegments = (cues: CaptionCue[]): OverlaySegment[] => {
  if (cues.length === 0) {
    return []
  }

  const segments: OverlaySegment[] = []
  const firstCue = cues[0]!
  if (firstCue.start > 0.05) {
    segments.push({
      start: 0,
      end: firstCue.start
    })
  }

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!
    segments.push({
      start: cue.start,
      end: cue.end,
      ...(index > 0 ? { previousText: cues[index - 1]!.text } : {}),
      currentText: cue.text,
      ...(index + 1 < cues.length ? { nextText: cues[index + 1]!.text } : {})
    })
  }

  const lastCue = cues[cues.length - 1]!
  segments.push({
    start: lastCue.end,
    end: lastCue.end + 2,
    previousText: lastCue.text
  })

  return segments.filter((segment) => segment.end > segment.start + 0.01)
}

const resolveConvertCommand = (): string | undefined => {
  if (commandExists('convert')) {
    return 'convert'
  }
  return undefined
}

const escapePangoMarkup = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const renderPangoLayer = async (
  options: {
    text?: string | undefined
    font: string
    fill: string
    pointSize: number
    width: number
    outputPath: string
    bold?: boolean | undefined
  }
): Promise<string | undefined> => {
  const text = options.text?.trim()
  if (!text) {
    return undefined
  }

  if (!commandExists('pango-view')) {
    throw new Error('Lyrics rendering fallback requires pango-view when ffmpeg lacks the ass filter')
  }

  const markup = `<span foreground="${options.fill}"${options.bold ? ' weight="bold"' : ''}>${escapePangoMarkup(text)}</span>`
  const result = await exec('pango-view', [
    '--no-display',
    '--markup',
    '--text', markup,
    '--background', 'transparent',
    '--margin', '0',
    '--align', 'center',
    '--width', String(Math.round(options.width * 0.6)),
    '--wrap', 'word-char',
    '--font', `${options.font} ${options.pointSize}`,
    '--output', options.outputPath
  ])
  if (result.exitCode !== 0) {
    throw new Error(`pango-view failed while rendering lyric text: ${result.stderr.trim() || result.stdout.trim()}`)
  }

  return options.outputPath
}

const renderOverlayCard = async (options: {
  outputPath: string
  width: number
  height: number
  font: string
  title: string
  previousText?: string | undefined
  currentText?: string | undefined
  nextText?: string | undefined
}): Promise<void> => {
  const convert = resolveConvertCommand()
  if (!convert) {
    throw new Error('Lyrics rendering requires either ffmpeg with the ass filter or ImageMagick convert for fallback text overlays')
  }

  const layerPaths = [
    await renderPangoLayer({
      text: options.title,
      font: options.font,
      fill: '#FFFFFF',
      pointSize: Math.round(options.height * 0.04),
      width: options.width,
      outputPath: `${options.outputPath}.title.png`,
      bold: true
    }),
    await renderPangoLayer({
      text: options.previousText,
      font: options.font,
      fill: '#C0C0C0',
      pointSize: Math.round(options.height * 0.038),
      width: options.width,
      outputPath: `${options.outputPath}.prev.png`
    }),
    await renderPangoLayer({
      text: options.currentText,
      font: options.font,
      fill: '#FFFFFF',
      pointSize: Math.round(options.height * 0.045),
      width: options.width,
      outputPath: `${options.outputPath}.current.png`,
      bold: true
    }),
    await renderPangoLayer({
      text: options.nextText,
      font: options.font,
      fill: '#C0C0C0',
      pointSize: Math.round(options.height * 0.038),
      width: options.width,
      outputPath: `${options.outputPath}.next.png`
    })
  ] as const

  const args = ['-size', `${options.width}x${options.height}`, 'xc:none']
  const composites: Array<{ path: string | undefined, gravity: 'north' | 'center', yOffset: number }> = [
    { path: layerPaths[0], gravity: 'north', yOffset: Math.round(options.height * 0.08) },
    { path: layerPaths[1], gravity: 'center', yOffset: -Math.round(options.height * 0.08) },
    { path: layerPaths[2], gravity: 'center', yOffset: 0 },
    { path: layerPaths[3], gravity: 'center', yOffset: Math.round(options.height * 0.08) }
  ]

  for (const composite of composites) {
    if (!composite.path) {
      continue
    }

    args.push(
      composite.path,
      '-gravity', composite.gravity,
      '-geometry', `+0${composite.yOffset >= 0 ? '+' : ''}${composite.yOffset}`,
      '-composite'
    )
  }
  args.push(`png32:${options.outputPath}`)

  const result = await exec(convert, args)
  if (result.exitCode !== 0) {
    throw new Error(`ImageMagick failed while rendering lyric overlay: ${result.stderr.trim() || result.stdout.trim()}`)
  }
}

const buildOverlaySequence = async (options: {
  overlayDir: string
  width: number
  height: number
  font: string
  title: string
  cues: CaptionCue[]
}): Promise<string> => {
  const segments = buildOverlaySegments(options.cues)
  const listLines: string[] = []
  let lastFramePath = ''

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const framePath = join(options.overlayDir, `frame-${String(index).padStart(4, '0')}.png`)
    await renderOverlayCard({
      outputPath: framePath,
      width: options.width,
      height: options.height,
      font: options.font,
      title: options.title,
      ...(segment.previousText ? { previousText: segment.previousText } : {}),
      ...(segment.currentText ? { currentText: segment.currentText } : {}),
      ...(segment.nextText ? { nextText: segment.nextText } : {})
    })
    listLines.push(`file '${framePath}'`)
    listLines.push(`duration ${(segment.end - segment.start).toFixed(3)}`)
    lastFramePath = framePath
  }

  if (lastFramePath.length > 0) {
    listLines.push(`file '${lastFramePath}'`)
  }

  const concatPath = join(options.overlayDir, 'frames.txt')
  await writeFile(concatPath, `${listLines.join('\n')}\n`)
  return concatPath
}

export const renderLyricsVideo = async (options: {
  audioPath: string
  assRelativePath: string
  outputRelativePath: string
  width: number
  height: number
  fps: number
  workingDirectory: string
  cues: CaptionCue[]
  title: string
  font: string
  imageRelativePath?: string | undefined
}): Promise<LyricsRenderSummary> => {
  const encoder = await detectLyricsEncoder()
  const encoderSettings = getEncoderSettings(encoder)
  const {
    audioPath,
    assRelativePath,
    outputRelativePath,
    width,
    height,
    fps,
    workingDirectory,
    cues,
    title,
    font,
    imageRelativePath
  } = options

  const useAssFilter = await hasFfmpegFilter('ass')
  const ffmpegArgs = useAssFilter
    ? (() => {
        const filter = imageRelativePath
          ? [
              '[0:v]',
              `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
              `,crop=${width}:${height}`,
              ',setpts=PTS-STARTPTS',
              ',eq=brightness=-0.15:contrast=0.85',
              ',vignette=PI/3.5',
              '[bg]',
              ';',
              `[bg]ass=filename=${assRelativePath}[v]`
            ].join('')
          : [
              '[0:a]',
              `showspectrum=s=${width}x${height}:mode=combined:color=intensity:scale=log`,
              ',format=yuv420p',
              ',vignette=PI/7',
              '[bg]',
              ';',
              `[bg]ass=filename=${assRelativePath}[v]`
            ].join('')

        return imageRelativePath
          ? [
              '-y',
              '-noautorotate',
              '-loop', '1',
              '-i', imageRelativePath,
              '-i', audioPath,
              '-filter_complex', filter,
              '-map', '[v]',
              '-map', '1:a',
              '-r', String(fps),
              ...encoderSettings,
              '-pix_fmt', 'yuv420p',
              '-metadata:s:v:0', 'rotate=0',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-shortest',
              outputRelativePath
            ]
          : [
              '-y',
              '-i', audioPath,
              '-filter_complex', filter,
              '-map', '[v]',
              '-map', '0:a',
              '-r', String(fps),
              ...encoderSettings,
              '-pix_fmt', 'yuv420p',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-shortest',
              outputRelativePath
            ]
      })()
    : (() => {
        const overlayDir = join(workingDirectory, 'overlay')
        return [
          '__fallback__',
          overlayDir
        ]
      })()

  const finalArgs = ffmpegArgs[0] === '__fallback__'
    ? await (async () => {
      const overlayDir = ffmpegArgs[1]!
        await mkdir(overlayDir, { recursive: true })
        const overlayConcatPath = await buildOverlaySequence({
          overlayDir,
          width,
          height,
          font,
          title,
          cues
        })

        const filter = imageRelativePath
          ? [
              '[0:v]',
              `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
              `,crop=${width}:${height}`,
              ',setpts=PTS-STARTPTS',
              ',eq=brightness=-0.15:contrast=0.85',
              ',vignette=PI/3.5',
              '[bg]',
              ';',
              '[bg][1:v]overlay=format=auto[v]'
            ].join('')
          : [
              '[0:a]',
              `showspectrum=s=${width}x${height}:mode=combined:color=intensity:scale=log`,
              ',format=yuv420p',
              ',vignette=PI/7',
              '[bg]',
              ';',
              '[bg][1:v]overlay=format=auto[v]'
            ].join('')

        return imageRelativePath
          ? [
              '-y',
              '-noautorotate',
              '-loop', '1',
              '-i', imageRelativePath,
              '-f', 'concat',
              '-safe', '0',
              '-i', overlayConcatPath,
              '-i', audioPath,
              '-filter_complex', filter,
              '-map', '[v]',
              '-map', '2:a',
              '-r', String(fps),
              ...encoderSettings,
              '-pix_fmt', 'yuv420p',
              '-metadata:s:v:0', 'rotate=0',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-shortest',
              outputRelativePath
            ]
          : [
              '-y',
              '-i', audioPath,
              '-f', 'concat',
              '-safe', '0',
              '-i', overlayConcatPath,
              '-filter_complex', filter,
              '-map', '[v]',
              '-map', '0:a',
              '-r', String(fps),
              ...encoderSettings,
              '-pix_fmt', 'yuv420p',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-shortest',
              outputRelativePath
            ]
      })()
    : ffmpegArgs

  const proc = Bun.spawn(['ffmpeg', ...finalArgs], {
    cwd: workingDirectory,
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) {
    throw new Error(`ffmpeg failed while rendering lyrics video: ${stderr.trim() || stdout.trim()}`)
  }

  return {
    encoder,
    backgroundMode: imageRelativePath ? 'image' : 'spectrogram'
  }
}
