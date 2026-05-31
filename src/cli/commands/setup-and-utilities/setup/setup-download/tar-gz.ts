import { chmod, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'

type TarGzExtractOptions = {
  destination: string
  stripComponents?: number
}

const BLOCK_SIZE = 512

const textDecoder = new TextDecoder()

const isZeroBlock = (block: Uint8Array): boolean => {
  for (const byte of block) {
    if (byte !== 0) return false
  }
  return true
}

const readNullTerminated = (buffer: Uint8Array, start: number, end: number): string => {
  let stop = start
  while (stop < end && buffer[stop] !== 0) stop++
  return textDecoder.decode(buffer.subarray(start, stop)).trim()
}

const readOctal = (buffer: Uint8Array, start: number, end: number): number => {
  const raw = readNullTerminated(buffer, start, end).replace(/\0/g, '').trim()
  if (raw.length === 0) return 0
  const parsed = Number.parseInt(raw, 8)
  return Number.isFinite(parsed) ? parsed : 0
}

const roundToBlock = (size: number): number => Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE

const normalizeTarPath = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\/+/, '')

const isUnsafeArchivePath = (path: string): boolean => {
  const normalized = normalizeTarPath(path)
  if (normalized.length === 0) return false
  if (posix.isAbsolute(normalized)) return true
  if (/^[A-Za-z]:/.test(normalized)) return true
  return normalized.split('/').some((segment) => segment === '..')
}

const sanitizeArchivePath = (path: string, stripComponents: number): string | null => {
  const normalized = normalizeTarPath(path)
  if (isUnsafeArchivePath(normalized)) {
    throw new Error(`Unsafe tar path rejected: ${path}`)
  }

  const components = normalized.split('/').filter((component) => component.length > 0)
  const stripped = components.slice(stripComponents)
  if (stripped.length === 0) return null

  const result = stripped.join('/')
  if (isUnsafeArchivePath(result)) {
    throw new Error(`Unsafe tar path rejected after strip-components: ${path}`)
  }
  return result
}

const assertSafeSymlinkTarget = (target: string, linkPath: string): void => {
  if (target.length === 0) return
  const normalizedTarget = normalizeTarPath(target)
  if (posix.isAbsolute(normalizedTarget) || /^[A-Za-z]:/.test(normalizedTarget)) {
    throw new Error(`Unsafe tar symlink target rejected: ${target}`)
  }

  const resolvedTarget = posix.normalize(posix.join(posix.dirname(linkPath), normalizedTarget))
  if (resolvedTarget === '..' || resolvedTarget.startsWith('../')) {
    throw new Error(`Unsafe tar symlink target rejected: ${target}`)
  }
}

const readHeaderPath = (header: Uint8Array): string => {
  const name = readNullTerminated(header, 0, 100)
  const prefix = readNullTerminated(header, 345, 500)
  return prefix ? `${prefix}/${name}` : name
}

export const extractTarGzBuffer = async (
  compressed: ArrayBuffer | Uint8Array<ArrayBuffer>,
  options: TarGzExtractOptions
): Promise<void> => {
  const stripComponents = Math.max(0, Math.floor(options.stripComponents ?? 0))
  const tarBytes = Bun.gunzipSync(compressed)
  await mkdir(options.destination, { recursive: true })

  let offset = 0
  while (offset + BLOCK_SIZE <= tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + BLOCK_SIZE)
    offset += BLOCK_SIZE

    if (isZeroBlock(header)) {
      const next = tarBytes.subarray(offset, offset + BLOCK_SIZE)
      if (next.byteLength === BLOCK_SIZE && isZeroBlock(next)) break
      continue
    }

    const rawPath = readHeaderPath(header)
    const mode = readOctal(header, 100, 108)
    const size = readOctal(header, 124, 136)
    const typeFlag = String.fromCharCode(header[156] ?? 0)
    const linkName = readNullTerminated(header, 157, 257)
    const payload = tarBytes.subarray(offset, offset + size)
    offset += roundToBlock(size)

    if (typeFlag === 'x' || typeFlag === 'g' || typeFlag === 'L' || typeFlag === 'K') {
      continue
    }

    const relativePath = sanitizeArchivePath(rawPath, stripComponents)
    if (!relativePath) {
      continue
    }

    const destinationPath = join(options.destination, relativePath)

    if (typeFlag === '5') {
      await mkdir(destinationPath, { recursive: true })
      continue
    }

    await mkdir(dirname(destinationPath), { recursive: true })

    if (typeFlag === '2') {
      assertSafeSymlinkTarget(linkName, relativePath)
      await rm(destinationPath, { recursive: true, force: true })
      await symlink(linkName, destinationPath)
      continue
    }

    if (typeFlag === '0' || typeFlag === '\0') {
      await Bun.write(destinationPath, payload)
      if (mode > 0) {
        await chmod(destinationPath, mode & 0o777)
      }
    }
  }
}