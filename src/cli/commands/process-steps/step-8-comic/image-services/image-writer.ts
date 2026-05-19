import { SUPPORTED_GENERATED_IMAGE_MIME_TYPES } from './image-types'

type BunImageEncoder = {
  png: () => BunImageEncoder
  bytes: () => Promise<Uint8Array>
}

type BunImageConstructor = new (source: Uint8Array | ArrayBuffer | Blob | string) => BunImageEncoder

const getBunImageConstructor = (): BunImageConstructor => {
  const imageConstructor = (Bun as unknown as { Image?: BunImageConstructor }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required to normalize generated images')
  }
  return imageConstructor
}

const detectGeneratedImageMimeType = (imageBytes: Buffer): string | undefined => {
  if (
    imageBytes.length >= 8
    && imageBytes[0] === 0x89
    && imageBytes[1] === 0x50
    && imageBytes[2] === 0x4e
    && imageBytes[3] === 0x47
    && imageBytes[4] === 0x0d
    && imageBytes[5] === 0x0a
    && imageBytes[6] === 0x1a
    && imageBytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    imageBytes.length >= 3
    && imageBytes[0] === 0xff
    && imageBytes[1] === 0xd8
    && imageBytes[2] === 0xff
  ) {
    return 'image/jpeg'
  }

  if (
    imageBytes.length >= 12
    && imageBytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && imageBytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return undefined
}

export const writeGeneratedImage = async (
  outputPath: string,
  imageBase64: string,
  mimeType?: string
): Promise<void> => {
  const imageBytes = Buffer.from(imageBase64, 'base64')
  const resolvedMimeType = mimeType ?? detectGeneratedImageMimeType(imageBytes)

  if (!resolvedMimeType || resolvedMimeType === 'image/png') {
    await Bun.write(outputPath, imageBytes)
    return
  }

  if (!SUPPORTED_GENERATED_IMAGE_MIME_TYPES.has(resolvedMimeType)) {
    throw new Error(`Generated image MIME type "${resolvedMimeType}" is not supported for write`)
  }

  const Image = getBunImageConstructor()
  const normalizedPngBytes = await new Image(imageBytes).png().bytes()
  await Bun.write(outputPath, normalizedPngBytes)
}
