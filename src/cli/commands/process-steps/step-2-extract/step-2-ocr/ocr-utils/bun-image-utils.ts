import { extname } from 'node:path'

type BunImageEncoder = {
  bytes: () => Promise<Uint8Array>
}

type BunImageReader = {
  png: () => BunImageEncoder
  metadata: () => Promise<{ width?: number | undefined; height?: number | undefined }>
}

type BunImageConstructor = new (source: Uint8Array | ArrayBuffer | Blob | string) => BunImageReader

const BUN_IMAGE_PNG_NORMALIZABLE_FORMATS = new Set(['bmp', 'gif', 'webp'])

const getBunImageConstructor = (): BunImageConstructor => {
  const imageConstructor = (Bun as unknown as { Image?: BunImageConstructor }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for OCR image normalization')
  }
  return imageConstructor
}

const getPathFormat = (imagePath: string): string =>
  extname(imagePath).replace(/^\./, '').toLowerCase()

export const isBunImagePngNormalizableFormat = (format: string): boolean =>
  BUN_IMAGE_PNG_NORMALIZABLE_FORMATS.has(format.toLowerCase())

export const normalizeImageToPngWithBun = async (
  imagePath: string,
  pngPath: string
): Promise<void> => {
  const format = getPathFormat(imagePath)
  if (!isBunImagePngNormalizableFormat(format)) {
    throw new Error(`Bun.Image PNG normalization is not enabled for ${format || 'unknown'} images`)
  }

  const Image = getBunImageConstructor()
  const pngBytes = await new Image(await Bun.file(imagePath).arrayBuffer()).png().bytes()
  await Bun.write(pngPath, pngBytes)
}

export const readImageDimensionsWithBun = async (
  imagePath: string
): Promise<{ width: number, height: number }> => {
  const Image = getBunImageConstructor()
  const metadata = await new Image(await Bun.file(imagePath).arrayBuffer()).metadata()
  const { width, height } = metadata
  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${imagePath}`)
  }

  return { width, height }
}
