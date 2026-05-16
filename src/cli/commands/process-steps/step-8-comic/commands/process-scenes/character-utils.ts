import { existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { l } from '../../utils/logger'
import { CharacterReferenceSchema } from '../../schemas/schemas'
import { parseJsonFile } from '../../utils/json-prompt-utils'
import {
  CHARACTER_SKETCHES_ROOT,
  getCharacterSketchesDirectory as getProjectCharacterSketchesDirectory,
  normalizeProjectPath,
  resolveCharacterInputAlias,
} from '../../utils/project-paths'
import type {
  CharacterDetails,
  CharacterSketchView,
  ImageGenerationModel,
} from '../../types'


const NON_CHARACTER_ENTRIES = ['SFX', 'SOUND', 'MUSIC', 'NARRATOR', 'TITLE', 'CAPTION', 'CHAT']
const CHARACTER_SOURCE_IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'] as const
export const CHARACTER_SKETCH_VIEWS = ['front', 'three-quarter', 'profile'] as const
export type CharacterSketchVariant = 'canonical' | 'revised'

type CharacterSketchDirectoryOptionInput = {
  imageModels?: unknown[]
  size?: unknown
  quality?: unknown
  revise?: boolean
  notes?: string
}


export const stripVoiceOverSuffix = (name: string): string => name.replace(/\s*\(V\.O\.\)\s*$/, '')

export const isCharacterEntry = (name: string): boolean => !NON_CHARACTER_ENTRIES.includes(stripVoiceOverSuffix(name))

const normalizeCharacterImagePath = (imagePath: string): string => {
  return normalizeProjectPath(imagePath)
}

const normalizeCharacterSketchesDirectoryPath = (inputPath: string): string => {
  return normalizeProjectPath(inputPath.trim()).replace(/\/+$/, '')
}

const getCharacterImageStem = (imagePath: string): string => {
  return basename(imagePath, extname(imagePath))
}

const getCharacterSketchFilenamePattern = (imagePath: string): RegExp => {
  const escapedStem = getCharacterImageStem(imagePath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedStem}--outline-(front|three-quarter|profile)(?:--(.+))?\\.png$`)
}

const getCharacterReferenceConfig = async () => {
  return parseJsonFile(
    join('src', 'cli', 'commands', 'process-steps', 'step-8-comic', 'config', 'characters-reference.json'),
    CharacterReferenceSchema
  )
}

export const resolveCharacterSourceImagePath = (inputPath: string): string => {
  const normalizedInputPath = normalizeCharacterImagePath(resolveCharacterInputAlias(inputPath.trim()))
  if (!normalizedInputPath) {
    throw new Error('Character image path cannot be empty')
  }

  const explicitExtension = extname(normalizedInputPath).toLowerCase()
  if (explicitExtension.length > 0) {
    if (!CHARACTER_SOURCE_IMAGE_EXTENSIONS.includes(explicitExtension as (typeof CHARACTER_SOURCE_IMAGE_EXTENSIONS)[number])) {
      throw new Error(
        `Unsupported character image extension "${explicitExtension}". ` +
        `Expected one of: ${CHARACTER_SOURCE_IMAGE_EXTENSIONS.join(', ')}`
      )
    }

    if (!existsSync(normalizedInputPath)) {
      throw new Error(`Character image "${normalizedInputPath}" was not found`)
    }

    return normalizedInputPath
  }

  for (const extension of CHARACTER_SOURCE_IMAGE_EXTENSIONS) {
    const candidate = `${normalizedInputPath}${extension}`
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Character image "${normalizedInputPath}" was not found. ` +
    `Tried: ${CHARACTER_SOURCE_IMAGE_EXTENSIONS.map(extension => `${normalizedInputPath}${extension}`).join(', ')}`
  )
}

export const resolveCharacterSketchesDirectoryPath = (inputPath: string): string | null => {
  const normalizedInputPath = normalizeCharacterSketchesDirectoryPath(inputPath)
  if (!normalizedInputPath) {
    throw new Error('Character image path cannot be empty')
  }

  const normalizedSketchesRoot = normalizeProjectPath(CHARACTER_SKETCHES_ROOT)
  const isSketchesDirectoryInput = normalizedInputPath === normalizedSketchesRoot
    || normalizedInputPath.startsWith(`${normalizedSketchesRoot}/`)

  if (!isSketchesDirectoryInput) {
    return null
  }

  if (normalizedInputPath === normalizedSketchesRoot) {
    throw new Error(
      `Character sketch directory must target one character, such as ${join(CHARACTER_SKETCHES_ROOT, '03-duco')}`
    )
  }

  if (!existsSync(normalizedInputPath)) {
    throw new Error(`Character sketch directory "${normalizedInputPath}" was not found`)
  }

  if (!statSync(normalizedInputPath).isDirectory()) {
    throw new Error(`Character sketch input "${normalizedInputPath}" is not a directory`)
  }

  return normalizedInputPath
}

export const getUnsupportedCharacterSketchDirectoryFlags = (
  options: CharacterSketchDirectoryOptionInput
): string[] => {
  return [
    ...(options.imageModels ? ['--image-model'] : []),
    ...(options.size ? ['--size'] : []),
    ...(options.quality ? ['--quality'] : []),
    ...(options.revise ? ['--revise'] : []),
    ...(options.notes ? ['--notes'] : []),
  ]
}

export const getCharacterSketchesDirectory = (imagePath: string): string => {
  return getProjectCharacterSketchesDirectory(imagePath)
}

export const getCharacterSketchStemFromDirectory = (sketchesDirectory: string): string => {
  const stem = basename(normalizeCharacterSketchesDirectoryPath(sketchesDirectory))
  if (!stem) {
    throw new Error(`Invalid character sketch directory "${sketchesDirectory}"`)
  }

  return stem
}

const getCharacterSketchVariantSuffix = (variant: CharacterSketchVariant): string => {
  return variant === 'revised' ? '--revised' : ''
}

export const getCharacterSketchImageFilenameForStem = (
  stem: string,
  view: CharacterSketchView,
  variant: CharacterSketchVariant = 'canonical'
): string => {
  return `${stem}--outline-${view}${getCharacterSketchVariantSuffix(variant)}.png`
}

export const getCharacterSketchImagePathForDirectory = (
  sketchesDirectory: string,
  view: CharacterSketchView,
  variant: CharacterSketchVariant = 'canonical'
): string => {
  return join(
    sketchesDirectory,
    getCharacterSketchImageFilenameForStem(getCharacterSketchStemFromDirectory(sketchesDirectory), view, variant)
  )
}

export const getCharacterSketchSheetImageFilenameForStem = (
  stem: string,
  variant: CharacterSketchVariant = 'canonical'
): string => {
  return `${stem}--outline-sheet${getCharacterSketchVariantSuffix(variant)}.png`
}

export const getCharacterSketchSheetImagePathForDirectory = (
  sketchesDirectory: string,
  variant: CharacterSketchVariant = 'canonical'
): string => {
  return join(
    sketchesDirectory,
    getCharacterSketchSheetImageFilenameForStem(getCharacterSketchStemFromDirectory(sketchesDirectory), variant)
  )
}

export const getCharacterSketchSheetImagePath = (
  imagePath: string,
  variant: CharacterSketchVariant = 'canonical'
): string => {
  return getCharacterSketchSheetImagePathForDirectory(getCharacterSketchesDirectory(imagePath), variant)
}

export const getCharacterSketchImageFilename = (
  imagePath: string,
  view: CharacterSketchView,
): string => {
  return `${getCharacterImageStem(imagePath)}--outline-${view}.png`
}

export const getCharacterSketchImagePath = (
  imagePath: string,
  view: CharacterSketchView,
  model?: ImageGenerationModel
): string => {
  const dir = getCharacterSketchesDirectory(imagePath)
  const filename = getCharacterSketchImageFilename(imagePath, view)
  return model ? join(dir, model, filename) : join(dir, filename)
}

export const findCharacterSketchImages = async (imagePath: string): Promise<string[]> => {
  const sketchesDirectory = getCharacterSketchesDirectory(imagePath)
  if (!existsSync(sketchesDirectory)) {
    return []
  }

  const revisedSheetPath = getCharacterSketchSheetImagePathForDirectory(sketchesDirectory, 'revised')
  if (existsSync(revisedSheetPath)) {
    return [revisedSheetPath]
  }

  const canonicalSheetPath = getCharacterSketchSheetImagePathForDirectory(sketchesDirectory)
  if (existsSync(canonicalSheetPath)) {
    return [canonicalSheetPath]
  }

  const sketchFilenamePattern = getCharacterSketchFilenamePattern(imagePath)
  const entries = await readdir(sketchesDirectory, { withFileTypes: true })
  const groupedCandidates = new Map<CharacterSketchView, Array<{ filename: string; model?: string }>>()

  entries.forEach(entry => {
    if (!entry.isFile()) {
      return
    }

    const match = entry.name.match(sketchFilenamePattern)
    const view = match?.[1] as CharacterSketchView | undefined
    if (!view) {
      return
    }

    const candidates = groupedCandidates.get(view) ?? []
    candidates.push({
      filename: entry.name,
      ...(match?.[2] ? { model: match[2] } : {}),
    })
    groupedCandidates.set(view, candidates)
  })

  return CHARACTER_SKETCH_VIEWS.flatMap(view => {
    const candidates = groupedCandidates.get(view)
    if (!candidates || candidates.length === 0) {
      return []
    }

    const preferredCandidate = [...candidates].sort((left, right) => {
      const leftPriority = left.model === undefined ? 0 : 1
      const rightPriority = right.model === undefined ? 0 : 1
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.filename.localeCompare(right.filename)
    })[0]

    return preferredCandidate ? [join(sketchesDirectory, preferredCandidate.filename)] : []
  })
}

export const getCharacterByImagePath = async (
  imagePath: string
): Promise<{ characterKey: string } & CharacterDetails | null> => {
  const reference = await getCharacterReferenceConfig()
  const normalizedImagePath = normalizeCharacterImagePath(imagePath)

  for (const [characterKey, character] of Object.entries(reference.charactersReference)) {
    if (normalizeCharacterImagePath(character.image) === normalizedImagePath) {
      return {
        characterKey,
        ...character,
        sketchImages: await findCharacterSketchImages(character.image),
      }
    }
  }

  return null
}

export const getCharacters = async (
  characters: string[]
): Promise<CharacterDetails[]> => {
  const reference = await getCharacterReferenceConfig()

  const results = await Promise.all(characters.map(async char => {
    const fullCharacter = reference.charactersReference[char as keyof typeof reference.charactersReference]
    if (!fullCharacter) {
      l.dim(`Character "${char}" not found in reference — skipping visual reference`)
      return null
    }

    const sketchImages = await findCharacterSketchImages(fullCharacter.image)
    return {
      ...fullCharacter,
      ...(sketchImages.length > 0 ? { sketchImages } : {}),
    }
  }))

  return results.filter(r => r !== null)
}

export const getCharacterImageFilename = (imagePath: string): string => basename(imagePath)
