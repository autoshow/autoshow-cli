import { extname } from 'node:path'
import type { BflImageModel, GeminiImageModel, GrokImageModel, ImageGenOptions, ImageTarget, OpenAIImageModel, ReveImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  supportsGeminiImageSize,
  validateBflImageModel,
  validateGeminiImageModel,
  validateGrokImageModel,
  validateOpenAIImageModel,
  validateReveImageModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureBflImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/bfl/bfl-image-gen'
import { ensureGeminiImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/gemini/gemini-image-gen'
import { ensureGrokImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/grok/grok-image-gen'
import { ensureOpenAIImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/openai/openai-image-gen'
import { ensureReveImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/reve/reve-image-gen'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { getBflImageExtension, normalizeBflImageOutputFormat, normalizeBflImageSize, runBflImageGen } from './image-services/bfl/run-bfl-image-gen'
import { runGeminiImageGen } from './image-services/gemini/run-gemini-image-gen'
import { normalizeGrokImageResolution, runGrokImageGen } from './image-services/grok/run-grok-image-gen'
import { runOpenAIImageGen } from './image-services/openai/run-openai-image-gen'
import { getReveImageExtension, normalizeReveImageAspectRatio, normalizeReveImageOutputFormat, normalizeReveImageSize, runReveImageGen } from './image-services/reve/run-reve-image-gen'
import {
  BFL_IMAGE_INPUT_MIME_TYPES,
  GEMINI_IMAGE_INPUT_MIME_TYPES,
  GROK_IMAGE_INPUT_MIME_TYPES,
  OPENAI_IMAGE_INPUT_MIME_TYPES,
  OPENAI_IMAGE_MASK_MIME_TYPES,
  REVE_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences,
  validateImageMaskReference
} from './image-utils/image-inputs'

const sanitizeImageModelName = sanitizeModelName

const normalizeOpenAIImageExtension = (format: string | undefined): string => {
  if (format === 'jpeg') {
    return 'jpg'
  }
  return format ?? 'png'
}

const OPENAI_FIXED_IMAGE_SIZES = new Set(['auto', '1024x1024', '1536x1024', '1024x1536'])
const OPENAI_IMAGE_QUALITIES = new Set(['auto', 'low', 'medium', 'high'])
const OPENAI_IMAGE_FORMATS = new Set(['png', 'jpeg', 'webp'])
const OPENAI_IMAGE_BACKGROUNDS = new Set(['auto', 'transparent', 'opaque'])
const GEMINI_NATIVE_ASPECT_RATIOS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'])
const GEMINI_IMAGE_SIZES = new Set(['1K', '2K', '4K'])
const GEMINI_RESPONSE_MODES = new Set(['image', 'text-image'])
const GROK_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', 'auto'])

const hasEditInputs = (options: Pick<ImageGenOptions, 'imageInputs' | 'imageMask'>): boolean =>
  (options.imageInputs?.length ?? 0) > 0 || options.imageMask !== undefined

const unsupportedFlagError = (
  provider: string,
  model: string,
  flags: string[],
  alternatives: string
): Error => CLIUsageError(
  `${flags.join(', ')} ${flags.length === 1 ? 'is' : 'are'} not supported by ${provider}/${model}. ${alternatives}`
)

const validateEnumOption = (
  provider: string,
  model: string,
  flagName: string,
  value: string | undefined,
  supported: ReadonlySet<string>
): void => {
  if (value === undefined) return
  if (!supported.has(value)) {
    throw CLIUsageError(
      `Invalid --${flagName} value "${value}" for ${provider}/${model}. Supported values: ${Array.from(supported).join(', ')}.`
    )
  }
}

const validateImageCount = (
  provider: string,
  model: string,
  value: number | undefined,
  min: number,
  max: number
): number => {
  const count = value ?? 1
  if (!Number.isInteger(count) || count < min || count > max) {
    throw CLIUsageError(`Invalid --image-count value "${String(value)}" for ${provider}/${model}. Supported range: ${min}-${max}.`)
  }
  return count
}

const collectUnsupportedCommonFlags = (
  options: ImageGenOptions,
  flagNames: Array<keyof ImageGenOptions>,
  flagLabels: Record<keyof ImageGenOptions, string>
): string[] => flagNames.flatMap((key) => options[key] !== undefined ? [flagLabels[key]] : [])

const IMAGE_OPTION_LABELS: Record<keyof ImageGenOptions, string> = {
  geminiImageModels: '--gemini-image',
  geminiImageModel: '--gemini-image',
  openaiImageModels: '--openai-image',
  openaiImageModel: '--openai-image',
  grokImageModels: '--grok-image',
  grokImageModel: '--grok-image',
  bflImageModels: '--bfl-image',
  bflImageModel: '--bfl-image',
  reveImageModels: '--reve-image',
  reveImageModel: '--reve-image',
  imageAspectRatio: '--image-aspect-ratio',
  imageSize: '--image-size',
  imageQuality: '--image-quality',
  imageFormat: '--image-format',
  imageBackground: '--image-background',
  imageCount: '--image-count',
  imageInputs: '--image-input',
  imageMask: '--image-mask',
  imageResponseMode: '--image-response-mode',
  geminiSearchGrounding: '--gemini-search-grounding',
  imageCompression: '--image-compression',
  imageProviderConcurrency: '--image-provider-concurrency',
  imageLocalConcurrency: '--image-local-concurrency'
}

const parseImageDimensions = (size: string): { width: number, height: number } | undefined => {
  const match = size.match(/^(\d+)x(\d+)$/i)
  if (!match) return undefined

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return undefined
  return { width, height }
}

const validateGptImage2Size = (size: string | undefined): void => {
  if (size === undefined || size.toLowerCase() === 'auto') {
    return
  }

  const dimensions = parseImageDimensions(size)
  if (!dimensions) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for gpt-image-2. Expected auto or WIDTHxHEIGHT.`)
  }

  const { width, height } = dimensions
  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  const totalPixels = width * height

  if (
    longEdge > 3840
    || width % 16 !== 0
    || height % 16 !== 0
    || longEdge / shortEdge > 3
    || totalPixels < 655_360
    || totalPixels > 8_294_400
  ) {
    throw CLIUsageError(
      `Invalid --image-size value "${size}" for gpt-image-2. Width and height must be multiples of 16, max edge <= 3840, aspect ratio <= 3:1, and total pixels between 655,360 and 8,294,400.`
    )
  }
}

const validateFixedOpenAIImageSize = (model: OpenAIImageModel, size: string | undefined): void => {
  if (size === undefined || OPENAI_FIXED_IMAGE_SIZES.has(size.toLowerCase())) {
    return
  }

  throw CLIUsageError(`Invalid --image-size value "${size}" for ${model}. Expected auto, 1024x1024, 1536x1024, or 1024x1536.`)
}

const validateOpenAIImageOptions = (
  model: OpenAIImageModel,
  options: Pick<ImageGenOptions, 'imageSize' | 'imageQuality' | 'imageFormat' | 'imageBackground' | 'imageCompression'>
): void => {
  validateEnumOption('OpenAI', model, 'image-quality', options.imageQuality, OPENAI_IMAGE_QUALITIES)
  validateEnumOption('OpenAI', model, 'image-format', options.imageFormat, OPENAI_IMAGE_FORMATS)
  validateEnumOption('OpenAI', model, 'image-background', options.imageBackground, OPENAI_IMAGE_BACKGROUNDS)
  if (options.imageCompression !== undefined) {
    const format = options.imageFormat ?? 'png'
    if (format !== 'jpeg' && format !== 'webp') {
      throw CLIUsageError(`--image-compression is only supported by OpenAI/${model} with --image-format jpeg or webp.`)
    }
  }

  if (model === 'gpt-image-2') {
    validateGptImage2Size(options.imageSize)
    if (options.imageBackground?.toLowerCase() === 'transparent') {
      throw CLIUsageError('--image-background transparent is not supported by OpenAI/gpt-image-2. Supported alternatives: opaque or auto.')
    }
    return
  }

  validateFixedOpenAIImageSize(model, options.imageSize)
}

export const getExpectedImageCount = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions
): number => {
  if (target.service === 'openai' || target.service === 'grok') {
    return Math.max(1, options.imageCount ?? 1)
  }

  return 1
}

const getExpectedImageExtension = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions
): string => {
  if (target.service === 'openai') {
    return normalizeOpenAIImageExtension(options.imageFormat)
  }

  if (target.service === 'grok') {
    return 'jpg'
  }

  if (target.service === 'bfl') {
    return getBflImageExtension(options.imageFormat)
  }

  if (target.service === 'reve') {
    return getReveImageExtension(options.imageFormat)
  }

  return 'png'
}

const getImageArtifactFileName = (
  target: Pick<ImageTarget, 'service' | 'model'> | Pick<Step5Metadata, 'imageService' | 'imageModel'>,
  singleTarget: boolean,
  sourceFileName: string,
  index: number
): string => {
  const ext = extname(sourceFileName).replace(/^\./, '') || 'png'
  if (singleTarget) {
    return index === 0 ? `generated-image.${ext}` : `generated-image-${index + 1}.${ext}`
  }

  const service = 'service' in target ? target.service : target.imageService
  const model = 'model' in target ? target.model : target.imageModel
  const baseName = `generated-image-${service}-${sanitizeImageModelName(model)}`
  return index === 0 ? `${baseName}.${ext}` : `${baseName}-${index + 1}.${ext}`
}

export const getImageArtifactFileNames = (
  target: Pick<ImageTarget, 'service' | 'model'> | Pick<Step5Metadata, 'imageService' | 'imageModel'>,
  sourceFileNames: string[],
  singleTarget: boolean
): string[] => sourceFileNames.map((fileName, index) =>
  getImageArtifactFileName(target, singleTarget, fileName, index)
)

export const getExpectedImageArtifactFileNames = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions,
  singleTarget: boolean
): string[] => {
  const imageCount = getExpectedImageCount(target, options)
  const extension = getExpectedImageExtension(target, options)

  return Array.from({ length: imageCount }, (_, index) =>
    getImageArtifactFileName(target, singleTarget, `placeholder.${extension}`, index)
  )
}

const getStep5ImageFileNames = (
  metadata: Pick<Step5Metadata, 'imageFileNames'>
): string[] => metadata.imageFileNames

export const buildImageArtifactMap = (metadata: Step5Metadata[]): Record<string, string> => {
  if (metadata.length === 1) {
    return Object.fromEntries(
      getStep5ImageFileNames(metadata[0]!).map((fileName, index) => [
        index === 0 ? 'image' : `image-${index + 1}`,
        fileName
      ])
    )
  }

  return Object.fromEntries(
    metadata.flatMap((entry) =>
      getStep5ImageFileNames(entry).map((fileName, index) => {
        const baseKey = `image-${entry.imageService}-${sanitizeImageModelName(entry.imageModel)}`
        return [index === 0 ? baseKey : `${baseKey}-${index + 1}`, fileName] as const
      })
    )
  )
}

export const collectImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  if (options.imageMask !== undefined && (options.imageInputs?.length ?? 0) === 0) {
    throw CLIUsageError('--image-mask requires at least one --image-input reference image.')
  }

  const targets: ImageTarget[] = []
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const grokModels = options.grokImageModels ?? (options.grokImageModel ? [options.grokImageModel] : [])
  const bflModels = options.bflImageModels ?? (options.bflImageModel ? [options.bflImageModel] : [])
  const reveModels = options.reveImageModels ?? (options.reveImageModel ? [options.reveImageModel] : [])

  for (const rawModel of geminiModels) {
    const model: GeminiImageModel = validateGeminiImageModel(rawModel)
    if (typeof options.imageSize === 'string' && options.imageSize.length > 0 && !supportsGeminiImageSize(model)) {
      throw CLIUsageError(`--image-size is not supported by Gemini/${model}. Supported alternatives: omit --image-size or use an image-size-capable Gemini image model.`)
    }
    validateEnumOption('Gemini', model, 'image-size', options.imageSize, GEMINI_IMAGE_SIZES)
    validateEnumOption('Gemini', model, 'image-response-mode', options.imageResponseMode, GEMINI_RESPONSE_MODES)
    validateEnumOption('Gemini', model, 'image-aspect-ratio', options.imageAspectRatio, GEMINI_NATIVE_ASPECT_RATIOS)
    if (options.imageCount !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--image-count'], 'Gemini native image generation returns one image per request; omit --image-count.')
    }
    if (options.imageMask !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--image-mask'], 'Gemini native image editing supports reference images via --image-input, not masks.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Gemini',
      model,
      allowedMimeTypes: GEMINI_IMAGE_INPUT_MIME_TYPES
    })
    const unsupportedCommon = collectUnsupportedCommonFlags(options, ['imageQuality', 'imageFormat', 'imageBackground', 'imageCompression'], IMAGE_OPTION_LABELS)
    if (unsupportedCommon.length > 0) {
      throw unsupportedFlagError('Gemini', model, unsupportedCommon, 'Supported Gemini image options are --image-aspect-ratio, --image-size, --image-response-mode, --image-input references, and --gemini-search-grounding.')
    }

    targets.push({
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        await ensureGeminiImageGenSetup()
        return await runGeminiImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          responseMode: options.imageResponseMode === 'text-image' ? 'text-image' : 'image',
          searchGrounding: options.geminiSearchGrounding
        })
      }
    })
  }

  for (const rawModel of openaiModels) {
    const model: OpenAIImageModel = validateOpenAIImageModel(rawModel)
    validateImageCount('OpenAI', model, options.imageCount, 1, 10)
    validateOpenAIImageOptions(model, {
      imageSize: options.imageSize,
      imageQuality: options.imageQuality,
      imageFormat: options.imageFormat,
      imageBackground: options.imageBackground,
      imageCompression: options.imageCompression
    })
    if (options.imageAspectRatio !== undefined) {
      throw unsupportedFlagError('OpenAI', model, ['--image-aspect-ratio'], 'Use --image-size for OpenAI dimensions.')
    }
    if (options.imageResponseMode !== undefined || options.geminiSearchGrounding === true) {
      const unsupported: string[] = []
      if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
      if (options.geminiSearchGrounding === true) unsupported.push('--gemini-search-grounding')
      throw unsupportedFlagError('OpenAI', model, unsupported, 'These flags are Gemini-only.')
    }
    if (hasEditInputs(options) && model === 'gpt-image-2') {
      throw unsupportedFlagError('OpenAI', model, ['--image-input', '--image-mask'], 'OpenAI documents image edits for gpt-image-1.5; use --openai gpt-image-1.5 for edit/reference inputs.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'OpenAI',
      model,
      allowedMimeTypes: OPENAI_IMAGE_INPUT_MIME_TYPES
    })
    validateImageMaskReference(options.imageMask, {
      provider: 'OpenAI',
      model,
      allowedMimeTypes: OPENAI_IMAGE_MASK_MIME_TYPES
    })

    targets.push({
      service: 'openai',
      model,
      run: async (prompt, outputDir) => {
        await ensureOpenAIImageGenSetup()
        return await runOpenAIImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          mask: options.imageMask,
          count: options.imageCount,
          size: options.imageSize,
          quality: options.imageQuality,
          outputFormat: options.imageFormat,
          background: options.imageBackground,
          compression: options.imageCompression
        })
      }
    })
  }

  for (const rawModel of grokModels) {
    const model: GrokImageModel = validateGrokImageModel(rawModel)
    validateImageCount('Grok', model, options.imageCount, 1, 10)
    validateEnumOption('Grok', model, 'image-aspect-ratio', options.imageAspectRatio, GROK_ASPECT_RATIOS)
    normalizeGrokImageResolution(options.imageSize)
    const unsupported = collectUnsupportedCommonFlags(options, [
      'imageQuality',
      'imageFormat',
      'imageBackground',
      'imageResponseMode',
      'imageCompression'
    ], IMAGE_OPTION_LABELS)
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.geminiSearchGrounding === true) unsupported.push('--gemini-search-grounding')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('Grok', model, unsupported, 'Supported Grok image options: --image-count, --image-aspect-ratio, --image-size 1K|2K, and up to three --image-input references.')
    }
    if (hasEditInputs(options) && model !== 'grok-imagine-image-quality') {
      throw unsupportedFlagError('Grok', model, ['--image-input'], 'xAI documents image editing for grok-imagine-image-quality; use --grok grok-imagine-image-quality for edit/reference inputs.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Grok',
      model,
      allowedMimeTypes: GROK_IMAGE_INPUT_MIME_TYPES,
      maxInputs: 3
    })

    targets.push({
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        await ensureGrokImageGenSetup()
        return await runGrokImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          count: options.imageCount,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize
        })
      }
    })
  }

  for (const rawModel of bflModels) {
    const model: BflImageModel = validateBflImageModel(rawModel)
    const unsupported: string[] = []
    if (options.imageAspectRatio) unsupported.push('--image-aspect-ratio')
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageCount !== undefined) unsupported.push('--image-count')
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
    if (options.geminiSearchGrounding === true) unsupported.push('--gemini-search-grounding')
    if (options.imageCompression !== undefined) unsupported.push('--image-compression')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('BFL', model, unsupported, 'Use --image-size WIDTHxHEIGHT for BFL dimensions, --image-format jpeg|png|webp for output format, and --image-input references.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'BFL',
      model,
      allowedMimeTypes: BFL_IMAGE_INPUT_MIME_TYPES,
      maxInputs: 8
    })
    normalizeBflImageSize(options.imageSize)
    normalizeBflImageOutputFormat(options.imageFormat)

    targets.push({
      service: 'bfl',
      model,
      run: async (prompt, outputDir) => {
        await ensureBflImageGenSetup()
        return await runBflImageGen(prompt, outputDir, {
          model,
          imageSize: options.imageSize,
          outputFormat: options.imageFormat,
          inputs: options.imageInputs
        })
      }
    })
  }

  for (const rawModel of reveModels) {
    const model: ReveImageModel = validateReveImageModel(rawModel)
    normalizeReveImageAspectRatio(options.imageAspectRatio)
    normalizeReveImageSize(options.imageSize)
    normalizeReveImageOutputFormat(options.imageFormat)
    const unsupported: string[] = []
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageCount !== undefined) unsupported.push('--image-count')
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
    if (options.geminiSearchGrounding === true) unsupported.push('--gemini-search-grounding')
    if (options.imageCompression !== undefined) unsupported.push('--image-compression')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('Reve', model, unsupported, 'Supported Reve image options: --image-aspect-ratio, --image-size WIDTHxHEIGHT fit-within resizing, --image-format png|jpeg|webp, and up to six --image-input references.')
    }
    if ((options.imageInputs?.length ?? 0) > 0 && model === 'reve-create@20250915') {
      throw unsupportedFlagError('Reve', model, ['--image-input'], 'Use --reve latest for Reve edit/remix workflows.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Reve',
      model,
      allowedMimeTypes: REVE_IMAGE_INPUT_MIME_TYPES,
      maxInputs: 6
    })

    targets.push({
      service: 'reve',
      model,
      run: async (prompt, outputDir) => {
        await ensureReveImageGenSetup()
        return await runReveImageGen(prompt, outputDir, {
          model,
          inputs: options.imageInputs,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          outputFormat: options.imageFormat
        })
      }
    })
  }

  return targets
}
