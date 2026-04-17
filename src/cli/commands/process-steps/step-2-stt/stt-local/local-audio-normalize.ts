import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PreparedLocalSttInput } from '~/types'
import { exec } from '~/utils/cli-utils'

export const prepareLocalSttInput = async (
  audioPath: string,
  tempPrefix: string
): Promise<PreparedLocalSttInput> => {
  const workspaceDir = await mkdtemp(join(tmpdir(), tempPrefix))
  const wavPath = join(workspaceDir, 'input.wav')

  try {
    const result = await exec('ffmpeg', [
      '-i', audioPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ])

    if (result.exitCode !== 0) {
      throw new Error(`Failed to prepare local STT input: ${result.stderr}`)
    }

    return {
      audioPath: wavPath,
      cleanup: async () => {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(workspaceDir, { recursive: true, force: true })
    throw error
  }
}
