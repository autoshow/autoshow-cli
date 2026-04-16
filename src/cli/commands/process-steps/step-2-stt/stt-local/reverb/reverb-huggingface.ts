import { commandExists, pathExists, runInherit, detectPlatform, reverbUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'

export const getHuggingFaceToken = (): string | undefined => {
  const token = process.env['HUGGINGFACE_TOKEN']
  return token && token.trim().length > 0 ? token.trim() : undefined
}

export const checkHuggingFaceCliInstalled = (): boolean => {
  const envCliA = `${reverbUvEnvDir}/bin/huggingface-cli`
  const envCliB = `${reverbUvEnvDir}/bin/huggingface`

  if (Bun.file(envCliA).size > 0 || Bun.file(envCliB).size > 0) {
    return true
  }

  return commandExists('huggingface-cli') || commandExists('huggingface')
}

export const installHuggingFaceCli = async (): Promise<void> => {
  const envPython = `${reverbUvEnvDir}/bin/python`
  if (await pathExists(reverbUvEnvDir)) {
    await runInherit('uv', ['pip', 'install', '-p', envPython, 'huggingface-hub[cli]'])
    return
  }

  const platform = detectPlatform()
  if (platform === 'darwin') {
    if (commandExists('brew')) {
      await runInherit('brew', ['install', 'huggingface-cli'])
    } else {
      await runInherit('pip3', ['install', '--user', 'huggingface-hub[cli]'])
    }
  } else {
    await runInherit('pip3', ['install', '--user', 'huggingface-hub[cli]'])
  }
}

export const getHuggingFaceCliPath = (): string | undefined => {
  const envCliA = `${reverbUvEnvDir}/bin/huggingface-cli`
  const envCliB = `${reverbUvEnvDir}/bin/huggingface`

  if (Bun.file(envCliA).size > 0) {
    return envCliA
  }

  if (Bun.file(envCliB).size > 0) {
    return envCliB
  }

  return Bun.which('huggingface-cli') || Bun.which('huggingface') || undefined
}
