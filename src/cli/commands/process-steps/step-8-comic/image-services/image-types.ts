export const IMAGE_GENERATION_SIZES = ['1536x1024', '1024x1024', '1024x1536', 'auto'] as const
export const IMAGE_GENERATION_QUALITIES = ['low', 'medium', 'high', 'auto'] as const

export const SUPPORTED_GENERATED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
])
