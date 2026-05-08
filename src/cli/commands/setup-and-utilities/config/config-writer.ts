import { ensureDirectory } from '~/utils/cli-utils'

export const writeConfig = async (configPath: string, config: Record<string, unknown>): Promise<void> => {
  const dirParts = configPath.split('/')
  dirParts.pop()
  const dir = dirParts.join('/')
  if (dir) {
    await ensureDirectory(dir)
  }
  await Bun.write(configPath, JSON.stringify(config, null, 2) + '\n')
}
