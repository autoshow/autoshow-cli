import { copyFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { RUNTIME_BIN_DIR } from '~/utils/runtime-paths'
import { makeExecutable, walkPaths } from '~/utils/filesystem'
import { downloadFile } from './download'
import { readDependencyVersion } from '../dependency-metadata'

const managedUvPath = join(RUNTIME_BIN_DIR, 'uv')
export const managedUvxPath = join(RUNTIME_BIN_DIR, 'uvx')

const DEFAULT_UV_VERSION = '0.11.14'

export const resolveUvAssetName = (
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch
): string => {
  if (platform === 'darwin') {
    if (arch === 'arm64') return 'uv-aarch64-apple-darwin.tar.gz'
    if (arch === 'x64') return 'uv-x86_64-apple-darwin.tar.gz'
  }

  if (platform === 'linux') {
    if (arch === 'arm64') return 'uv-aarch64-unknown-linux-gnu.tar.gz'
    if (arch === 'x64') return 'uv-x86_64-unknown-linux-gnu.tar.gz'
  }

  throw new Error(`Unsupported platform for managed uv setup: ${platform}/${arch}`)
}

export const resolveUvDownloadUrl = (version: string, assetName: string): string =>
  `https://github.com/astral-sh/uv/releases/download/${version}/${assetName}`

const existingFile = async (path: string): Promise<string | undefined> => {
  const file = Bun.file(path)
  return await file.exists() && file.size > 0 ? path : undefined
}

export const resolveUvCommandFromCandidates = async (
  pathUv: string | null | undefined,
  managedPath = managedUvPath
): Promise<string | undefined> => {
  if (pathUv) return pathUv
  return await existingFile(managedPath)
}

export const resolveUvCommand = async (): Promise<string | undefined> => {
  return await resolveUvCommandFromCandidates(Bun.which('uv'), managedUvPath)
}

const findExtractedBinary = async (root: string, name: 'uv' | 'uvx'): Promise<string> => {
  const direct = join(root, name)
  if (await Bun.file(direct).exists()) return direct
  const matches = (await walkPaths(root, { kind: 'file' })).filter((path) => path.endsWith(`/${name}`))
  const found = matches[0]
  if (!found) {
    throw new Error(`Managed uv archive did not contain ${name}`)
  }
  return found
}

export const installManagedUv = async (): Promise<void> => {
  const version = await readDependencyVersion('uv') ?? DEFAULT_UV_VERSION
  const assetName = resolveUvAssetName()
  const url = resolveUvDownloadUrl(version, assetName)
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-uv-'))

  try {
    await downloadFile({
      url,
      destination: tempRoot,
      mode: 'tar-gz',
      stripComponents: 1,
      flowId: 'uv-release'
    })

    await mkdir(RUNTIME_BIN_DIR, { recursive: true })
    await copyFile(await findExtractedBinary(tempRoot, 'uv'), managedUvPath)
    await copyFile(await findExtractedBinary(tempRoot, 'uvx'), managedUvxPath)
    await makeExecutable(managedUvPath)
    await makeExecutable(managedUvxPath)
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}
