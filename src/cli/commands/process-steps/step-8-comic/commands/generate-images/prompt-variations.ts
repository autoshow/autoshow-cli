import type {
  ImagePromptVariation,
  PromptsConfig,
} from '../../types'

export const IMAGE_PROMPT_VARIATIONS: ImagePromptVariation[] = [
  'canonical',
  'animation-polish',
  'cinematic-depth',
]

const IMAGE_PROMPT_VARIATION_OPTIONS = new Set<string>(IMAGE_PROMPT_VARIATIONS)

const IMAGE_PROMPT_VARIATION_LABELS: Record<ImagePromptVariation, string> = {
  canonical: 'Canonical',
  'animation-polish': 'Animation polish',
  'cinematic-depth': 'Cinematic depth',
}

export const parseImagePromptVariations = (value: string): ImagePromptVariation[] => {
  const rawVariations = value.split(',').map(variation => variation.trim())
  if (rawVariations.some(variation => variation.length === 0)) {
    throw new Error(
      `Invalid variation list "${value}". Expected one or more comma-separated values from: ${IMAGE_PROMPT_VARIATIONS.join(', ')}`
    )
  }

  const parsedVariations: ImagePromptVariation[] = []
  const seenVariations = new Set<string>()

  for (const variation of rawVariations) {
    if (!IMAGE_PROMPT_VARIATION_OPTIONS.has(variation)) {
      throw new Error(
        `Invalid variation "${variation}". Expected one or more comma-separated values from: ${IMAGE_PROMPT_VARIATIONS.join(', ')}`
      )
    }

    if (seenVariations.has(variation)) {
      throw new Error(`Duplicate variation "${variation}" is not allowed`)
    }

    seenVariations.add(variation)
    parsedVariations.push(variation as ImagePromptVariation)
  }

  return parsedVariations
}

export const getImagePromptVariationLabel = (
  variation: ImagePromptVariation
): string => {
  return IMAGE_PROMPT_VARIATION_LABELS[variation]
}

export const applyImagePromptVariation = (
  normalizedPrompt: string,
  variation: ImagePromptVariation,
  prompts: PromptsConfig
): string => {
  if (variation === 'canonical') {
    return normalizedPrompt
  }

  const variationPrompt = prompts['Image Prompt Variations'][variation].trim()
  if (!variationPrompt) {
    throw new Error(`Image prompt variation "${variation}" is empty`)
  }

  return `${variationPrompt}\n\n${normalizedPrompt}`
}
