import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { commandExists, exec } from '~/utils/cli-utils'
import {
  CHARACTER_SKETCH_VIEWS,
  getCharacterSketchImagePathForDirectory,
  getCharacterSketchSheetImagePathForDirectory,
} from '../process-scenes/character-utils'
import type {
  CharacterSketchVariant,
} from '../process-scenes/character-utils'
import type {
  CharacterSketchView,
} from '../../types'



export type CharacterSketchSheetSource = {
  view: CharacterSketchView
  path: string
}

export type CharacterSketchSheetSelection = {
  variant: CharacterSketchVariant
  outputPath: string
  sources: CharacterSketchSheetSource[]
}

const CHARACTER_SKETCH_SHEET_VARIANTS: CharacterSketchVariant[] = ['revised', 'canonical']

type BunImageMetadataReader = {
  metadata: () => Promise<{ width?: number | undefined; height?: number | undefined }>
}

type BunImageConstructor = new (source: Uint8Array | ArrayBuffer | Blob | string) => BunImageMetadataReader

type CharacterSketchSheetSourceMetadata = CharacterSketchSheetSource & {
  width: number
  height: number
}

const getMissingSketchViews = (
  sketchesDirectory: string,
  variant: CharacterSketchVariant
): CharacterSketchView[] => {
  return CHARACTER_SKETCH_VIEWS.filter(view => {
    return !existsSync(getCharacterSketchImagePathForDirectory(sketchesDirectory, view, variant))
  })
}

const formatVariant = (variant: CharacterSketchVariant): string => {
  return variant === 'revised' ? 'revised' : 'canonical'
}

export const selectCharacterSketchSheetSources = (
  sketchesDirectory: string
): CharacterSketchSheetSelection => {
  for (const variant of CHARACTER_SKETCH_SHEET_VARIANTS) {
    const missingViews = getMissingSketchViews(sketchesDirectory, variant)
    if (missingViews.length > 0) {
      continue
    }

    return {
      variant,
      outputPath: getCharacterSketchSheetImagePathForDirectory(sketchesDirectory, variant),
      sources: CHARACTER_SKETCH_VIEWS.map(view => ({
        view,
        path: getCharacterSketchImagePathForDirectory(sketchesDirectory, view, variant),
      })),
    }
  }

  const missingDetails = CHARACTER_SKETCH_SHEET_VARIANTS.map(variant => {
    const missingViews = getMissingSketchViews(sketchesDirectory, variant)
    return `${formatVariant(variant)} missing ${missingViews.join(', ')}`
  }).join('; ')

  throw new Error(
    `Could not find a complete front, three-quarter, and profile sketch trio in ${sketchesDirectory}. ` +
    missingDetails
  )
}

const getBunImageConstructor = (): BunImageConstructor => {
  const imageConstructor = (Bun as unknown as { Image?: BunImageConstructor }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required to read character sketch dimensions')
  }
  return imageConstructor
}

const resolveImageMagickCommand = (): string => {
  if (commandExists('magick')) {
    return 'magick'
  }
  if (commandExists('convert')) {
    return 'convert'
  }
  throw new Error(
    'Character sketch sheet composition requires ImageMagick. Install ImageMagick so `magick` or `convert` is available on PATH.'
  )
}

const identifyImageDimensions = async (
  source: CharacterSketchSheetSource
): Promise<CharacterSketchSheetSourceMetadata> => {
  const Image = getBunImageConstructor()
  const metadata = await new Image(await Bun.file(source.path).arrayBuffer()).metadata()
  const { width, height } = metadata
  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${source.path}`)
  }

  return {
    ...source,
    width,
    height,
  }
}

export const combineCharacterSketchSheet = async (
  selection: CharacterSketchSheetSelection
): Promise<{ width: number; height: number }> => {
  const command = resolveImageMagickCommand()
  const sourceMetadata = await Promise.all(selection.sources.map(async source => {
    return await identifyImageDimensions(source)
  }))

  if (sourceMetadata.length === 0) {
    throw new Error('Character sketch sheet requires at least one source image')
  }

  const sheetWidth = sourceMetadata.reduce((sum, source) => sum + source.width, 0)
  const sheetHeight = Math.max(...sourceMetadata.map(source => source.height))
  let left = 0
  const compositeArgs = sourceMetadata.flatMap(source => {
    const currentLeft = left
    left += source.width

    return [
      source.path,
      '-geometry',
      `+${currentLeft}+${Math.floor((sheetHeight - source.height) / 2)}`,
      '-composite',
    ]
  })

  const result = await exec(command, [
    '-size',
    `${sheetWidth}x${sheetHeight}`,
    'xc:white',
    ...compositeArgs,
    selection.outputPath,
  ])
  if (result.exitCode !== 0) {
    throw new Error(`ImageMagick failed to compose character sketch sheet: ${result.stderr || result.stdout}`)
  }

  return {
    width: sheetWidth,
    height: sheetHeight,
  }
}

export const describeCharacterSketchSheetSources = (
  selection: CharacterSketchSheetSelection
): string => {
  return selection.sources.map(source => `${source.view}: ${basename(source.path)}`).join(', ')
}
