import { exec } from '~/utils/cli-utils'

export const splitTextIntoChunks = (text: string, maxChars: number): string[] => {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars)
    if (splitAt < Math.floor(maxChars * 0.5)) {
      splitAt = remaining.lastIndexOf(' ', maxChars)
    }
    if (splitAt < Math.floor(maxChars * 0.5)) {
      splitAt = maxChars
    }

    const chunk = remaining.slice(0, splitAt).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }
    remaining = remaining.slice(splitAt).trim()
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

  return chunks
}

export const concatAndConvertToWav = async (
  chunkPaths: string[],
  outputDir: string,
  providerLabel: string
): Promise<string> => {
  const wavPath = `${outputDir}/speech.wav`

  if (chunkPaths.length === 1) {
    const ffmpeg = await exec('ffmpeg', [
      '-i', chunkPaths[0] as string,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ])
    if (ffmpeg.exitCode !== 0) {
      throw new Error(`Failed to convert ${providerLabel} audio to WAV: ${ffmpeg.stderr.trim()}`)
    }
    return wavPath
  }

  const concatListPath = `${outputDir}/speech-${providerLabel.toLowerCase()}-chunks.txt`
  const concatList = chunkPaths
    .map(path => `file '${path.replace(/'/g, `'\\''`)}'`)
    .join('\n')
  await Bun.write(concatListPath, `${concatList}\n`)

  const ffmpeg = await exec('ffmpeg', [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    wavPath
  ])

  if (ffmpeg.exitCode !== 0) {
    throw new Error(`Failed to concatenate ${providerLabel} audio chunks: ${ffmpeg.stderr.trim()}`)
  }

  await Bun.$`rm -f ${concatListPath}`.quiet().nothrow()
  return wavPath
}
