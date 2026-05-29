import { existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { CLIUsageError } from '~/utils/error-handler'
import type { GeminiPart } from '~/utils/gemini/gemini-rest'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif'
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
}

const prettyMimeList = (mimeTypes: readonly string[]): string =>
  mimeTypes.map((mimeType) => mimeType.replace(/^image\//, '')).join('|')

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isDataImageUrl = (value: string): boolean =>
  /^data:image\/[a-z0-9.+-]+;base64,/i.test(value)

const getLocalMimeType = (value: string): string | undefined =>
  MIME_BY_EXTENSION[extname(value).toLowerCase()]

const getUrlMimeType = (value: string): string | undefined => {
  try {
    return MIME_BY_EXTENSION[extname(new URL(value).pathname).toLowerCase()]
  } catch {
    return undefined
  }
}

const getDataUrlMimeType = (value: string): string | undefined => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(value)
  return match?.[1]?.toLowerCase()
}

const getReferenceMimeType = (value: string): string | undefined => {
  if (isDataImageUrl(value)) return getDataUrlMimeType(value)
  if (isHttpUrl(value)) return getUrlMimeType(value)
  return getLocalMimeType(value)
}

const assertSupportedMimeType = (
  flagName: '--image-input' | '--image-mask',
  value: string,
  provider: string,
  model: string,
  mimeType: string | undefined,
  allowedMimeTypes: readonly string[]
): void => {
  if (mimeType === undefined || !allowedMimeTypes.includes(mimeType)) {
    throw CLIUsageError(
      `Unsupported ${flagName} value "${value}" for ${provider}/${model}. Expected ${prettyMimeList(allowedMimeTypes)} image files or URLs.`
    )
  }
}

export const validateImageInputReferences = (
  inputs: readonly string[] | undefined,
  options: {
    provider: string
    model: string
    allowedMimeTypes: readonly string[]
    maxInputs?: number | undefined
  }
): void => {
  const values = inputs ?? []
  if (options.maxInputs !== undefined && values.length > options.maxInputs) {
    throw CLIUsageError(
      `--image-input supports at most ${options.maxInputs} reference images for ${options.provider}/${options.model}.`
    )
  }

  for (const value of values) {
    if (isHttpUrl(value)) {
      const mimeType = getReferenceMimeType(value)
      if (mimeType !== undefined) {
        assertSupportedMimeType('--image-input', value, options.provider, options.model, mimeType, options.allowedMimeTypes)
      }
      continue
    }
    if (isDataImageUrl(value)) {
      assertSupportedMimeType('--image-input', value, options.provider, options.model, getReferenceMimeType(value), options.allowedMimeTypes)
      continue
    }

    if (!existsSync(value)) {
      throw CLIUsageError(`--image-input file "${value}" does not exist for ${options.provider}/${options.model}.`)
    }
    assertSupportedMimeType('--image-input', value, options.provider, options.model, getLocalMimeType(value), options.allowedMimeTypes)
  }
}

export const validateImageMaskReference = (
  mask: string | undefined,
  options: {
    provider: string
    model: string
    allowedMimeTypes: readonly string[]
  }
): void => {
  if (mask === undefined) return
  if (isHttpUrl(mask) || isDataImageUrl(mask)) {
    throw CLIUsageError(`--image-mask must be a local image file for ${options.provider}/${options.model}.`)
  }
  if (!existsSync(mask)) {
    throw CLIUsageError(`--image-mask file "${mask}" does not exist for ${options.provider}/${options.model}.`)
  }
  assertSupportedMimeType('--image-mask', mask, options.provider, options.model, getLocalMimeType(mask), options.allowedMimeTypes)
}

const fetchImageBytes = async (url: string): Promise<{ bytes: Uint8Array, mimeType: string, fileName: string }> => {
  const response = await fetch(url, { headers: { accept: 'image/*,*/*;q=0.8' } })
  if (!response.ok) {
    throw new Error(`Image reference download failed (${response.status}): ${url}`)
  }
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  const fallbackMimeType = getUrlMimeType(url) ?? 'image/png'
  const mimeType = contentType?.startsWith('image/') ? contentType : fallbackMimeType
  const bytes = new Uint8Array(await response.arrayBuffer())
  const urlName = basename(new URL(url).pathname)
  const ext = EXTENSION_BY_MIME[mimeType] ?? 'png'
  return {
    bytes,
    mimeType,
    fileName: urlName.length > 0 ? urlName : `image.${ext}`
  }
}

const dataUrlToBytes = (value: string): { bytes: Uint8Array, mimeType: string, fileName: string } => {
  const mimeType = getDataUrlMimeType(value) ?? 'image/png'
  const base64 = value.slice(value.indexOf(',') + 1)
  const ext = EXTENSION_BY_MIME[mimeType] ?? 'png'
  return {
    bytes: new Uint8Array(Buffer.from(base64, 'base64')),
    mimeType,
    fileName: `image.${ext}`
  }
}

export const appendImageReferenceToForm = async (
  form: FormData,
  fieldName: string,
  value: string
): Promise<void> => {
  if (isDataImageUrl(value)) {
    const { bytes, mimeType, fileName } = dataUrlToBytes(value)
    form.append(fieldName, new Blob([bytes], { type: mimeType }), fileName)
    return
  }

  if (isHttpUrl(value)) {
    const { bytes, mimeType, fileName } = await fetchImageBytes(value)
    form.append(fieldName, new Blob([bytes], { type: mimeType }), fileName)
    return
  }

  const mimeType = getLocalMimeType(value) ?? 'image/png'
  form.append(fieldName, Bun.file(value, { type: mimeType }), basename(value))
}

export const imageReferenceToDataUrl = async (value: string): Promise<string> => {
  if (isDataImageUrl(value)) return value
  if (isHttpUrl(value)) return value

  const mimeType = getLocalMimeType(value) ?? 'image/png'
  const bytes = await Bun.file(value).arrayBuffer()
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
}

export const imageReferenceToUrlOrDataUrl = async (value: string): Promise<string> =>
  isHttpUrl(value) ? value : await imageReferenceToDataUrl(value)

export const imageReferenceToBase64 = async (value: string): Promise<string> => {
  if (isDataImageUrl(value)) {
    return value.slice(value.indexOf(',') + 1)
  }

  if (isHttpUrl(value)) {
    const { bytes } = await fetchImageBytes(value)
    return Buffer.from(bytes).toString('base64')
  }

  const bytes = await Bun.file(value).arrayBuffer()
  return Buffer.from(bytes).toString('base64')
}

export const imageReferenceToInlineDataPart = async (value: string): Promise<GeminiPart> => {
  if (isDataImageUrl(value)) {
    const { bytes, mimeType } = dataUrlToBytes(value)
    return {
      inlineData: {
        mimeType,
        data: Buffer.from(bytes).toString('base64')
      }
    }
  }

  if (isHttpUrl(value)) {
    const { bytes, mimeType } = await fetchImageBytes(value)
    return {
      inlineData: {
        mimeType,
        data: Buffer.from(bytes).toString('base64')
      }
    }
  }

  const mimeType = getLocalMimeType(value) ?? 'image/png'
  const bytes = await Bun.file(value).arrayBuffer()
  return {
    inlineData: {
      mimeType,
      data: Buffer.from(bytes).toString('base64')
    }
  }
}

export const OPENAI_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const OPENAI_IMAGE_MASK_MIME_TYPES = ['image/png'] as const
export const GROK_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg'] as const
export const GEMINI_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const
export const BFL_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const REVE_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
