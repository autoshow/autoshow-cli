import { defineCommand } from 'clerc'
import { configCommandFlags } from '~/cli/flags'
import { resolveConfigPath, loadConfig } from './config-loader'
import { extractExplicitFlags, buildConfigPatchFromFlags, deepMergeConfig } from './config-merge'
import { writeConfig } from './config-writer'
import * as l from '~/logger'

export const configCommand = defineCommand({
  name: 'config',
  description: 'View or set default CLI options saved to config/autoshow.json',
  flags: configCommandFlags,
  help: {
    examples: [
      ['bun as config --show', 'Print current config'],
      ['bun as config --openai gpt-5.4 --whisper base', 'Set default LLM and STT model'],
      ['bun as config --reset', 'Clear all saved config']
    ]
  }
}, async (ctx) => {
  const flags = ctx.flags
  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const resolvedPath = await resolveConfigPath(configPathOverride)

  if (flags['show'] === true) {
    const config = await loadConfig(resolvedPath)
    l.info(`Config path: ${resolvedPath}`)
    l.info(JSON.stringify(config, null, 2))
    return
  }

  if (flags['reset'] === true) {
    await writeConfig(resolvedPath, {})
    l.success(`Config reset: ${resolvedPath}`)
    return
  }

  const preprocessedArgv = Bun.argv.slice(2)
  const explicitFlagNames = extractExplicitFlags(preprocessedArgv)
  const patch = buildConfigPatchFromFlags(flags as Record<string, unknown>, explicitFlagNames, preprocessedArgv)

  if (Object.keys(patch).length === 0) {
    l.info(`No changes to write. Config path: ${resolvedPath}`)
    l.info('Use --show to print current config or --reset to clear it.')
    return
  }

  const current = await loadConfig(resolvedPath)
  const updated = deepMergeConfig(current as Record<string, unknown>, patch)
  await writeConfig(resolvedPath, updated)
  l.success(`Config saved to ${resolvedPath}`)
})
