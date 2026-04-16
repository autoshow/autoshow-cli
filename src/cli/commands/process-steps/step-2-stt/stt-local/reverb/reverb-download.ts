import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { commandExists, pathExists, runCapture, runInherit, detectPlatform, reverbConfigPath, reverbDiarizationDir, reverbModelDir, reverbModelPath, reverbUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import * as l from '~/logger'
import { withRetry } from '~/utils/retries'
import {
  checkHuggingFaceCliInstalled,
  getHuggingFaceCliPath,
  getHuggingFaceToken,
  installHuggingFaceCli
} from './reverb-huggingface'

const reverbScriptsDir = join(dirname(fileURLToPath(import.meta.url)), 'scripts')

export const checkReverbModelExists = async (): Promise<boolean> => {
  return await pathExists(reverbModelPath) && await pathExists(reverbConfigPath)
}

export const checkDiarizationModelCached = async (): Promise<boolean> => {
  return await pathExists(reverbDiarizationDir)
}

const checkGitLfsInstalled = (): boolean => {
  return commandExists('git-lfs')
}

const installGitLfs = async (): Promise<void> => {
  l.info('Installing git-lfs')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    if (!commandExists('brew')) {
      l.error('Homebrew not found. Please install git-lfs manually')
      throw new Error('Homebrew not found for git-lfs installation')
    }

    await runInherit('brew', ['install', 'git-lfs'])
    await Bun.sleep(2000)

    const brewPrefixResult = await runCapture('brew', ['--prefix'], { allowFailure: true })
    const brewPrefix = brewPrefixResult.exitCode === 0 ? brewPrefixResult.stdout.trim() : '/usr/local'
    const gitLfsPath = `${brewPrefix}/bin/git-lfs`

    if (await pathExists(gitLfsPath)) {
      await runInherit(gitLfsPath, ['install'])
    } else {
      await runInherit('git', ['lfs', 'install'])
    }

    l.success('git-lfs installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt-get', 'update'])
    await runInherit('sudo', ['apt-get', 'install', '-y', 'git-lfs'])
    await runInherit('git', ['lfs', 'install'])
    l.success('git-lfs installed')
    return
  }

  l.error('Unsupported platform for automatic git-lfs installation')
  throw new Error('Unsupported platform for git-lfs setup')
}

export const downloadReverbModel = async (): Promise<void> => {
  l.info('Downloading Reverb ASR model from HuggingFace')

  if (await checkReverbModelExists()) {
    l.success('Reverb model already exists')
    return
  }

  await mkdir(reverbModelDir, { recursive: true })

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.error('HuggingFace token is required to download Reverb model')
    l.info('Please set the HUGGINGFACE_TOKEN environment variable')
    throw new Error('Missing HuggingFace token')
  }

  if (!checkGitLfsInstalled()) {
    await installGitLfs()
    await Bun.sleep(2000)
  }

  if (!checkHuggingFaceCliInstalled()) {
    await installHuggingFaceCli().catch(() => undefined)
  }

  const hfCliPath = getHuggingFaceCliPath()

  await withRetry(
    { retryClass: 'setup_download', operationName: 'reverb-model' },
    async () => {
      await rm(reverbModelDir, { recursive: true, force: true })

      const env = {
        HF_HUB_DISABLE_PROGRESS_BARS: '1',
        HF_HUB_VERBOSITY: 'error'
      }

      let usedCli = false

      if (hfCliPath) {
        const cliResult = await runInherit(
          hfCliPath,
          ['download', 'Revai/reverb-asr', '--token', hfToken, '--local-dir', reverbModelDir, '--local-dir-use-symlinks', 'False'],
          { env, allowFailure: true }
        )
        usedCli = cliResult === 0
      }

      if (!usedCli) {
        const HOME = Bun.env['HOME'] || process.env['HOME'] || ''
        await runInherit('git', ['config', '--global', 'credential.helper', 'store'])
        await Bun.write(`${HOME}/.git-credentials`, `https://oauth2:${hfToken}@huggingface.co\n`)

        const mergedEnv: Record<string, string | undefined> = {
          ...env,
          GIT_TERMINAL_PROMPT: '0'
        }

        if (detectPlatform() === 'darwin') {
          const brewPrefixResult = await runCapture('brew', ['--prefix'], { allowFailure: true })
          const brewPrefix = brewPrefixResult.exitCode === 0 ? brewPrefixResult.stdout.trim() : '/usr/local'
          mergedEnv['PATH'] = `${brewPrefix}/bin:${process.env['PATH'] || ''}`
        }

        const cloneCode = await runInherit(
          'git',
          ['clone', `https://oauth2:${hfToken}@huggingface.co/Revai/reverb-asr`, reverbModelDir],
          { env: mergedEnv, allowFailure: true }
        )

        if (cloneCode !== 0) {
          l.error('Git clone also failed')
          throw new Error('Failed to download Reverb model')
        }
      }

      if (!await checkReverbModelExists()) {
        l.error('Model files not found after download')
        throw new Error('Reverb model files missing after download')
      }
    }
  )

  l.success('Reverb ASR model downloaded')
}

export const downloadDiarizationModel = async (): Promise<boolean> => {
  if (await checkDiarizationModelCached()) {
    l.success('Diarization model v2 already cached')
    return true
  }

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.warn('No HUGGINGFACE_TOKEN found, cannot download diarization model')
    return false
  }

  await mkdir(reverbDiarizationDir, { recursive: true })

  const scriptPath = join(reverbScriptsDir, 'download-reverb-diarization.py')
  const result = await runCapture(
    'uv',
    ['run', '-p', `${reverbUvEnvDir}/bin/python`, scriptPath, 'Revai/reverb-diarization-v2', hfToken],
    {
      allowFailure: true,
      env: {
        HF_HOME: reverbDiarizationDir,
        TRANSFORMERS_CACHE: reverbDiarizationDir
      }
    }
  )

  if (result.exitCode !== 0) {
    l.error('Failed to download diarization model v2')
    const details = result.stderr.trim()
    if (details) {
      l.error(`Error details: ${details}`)
    }
    return false
  }

  l.success('Diarization model v2 downloaded')
  return true
}
