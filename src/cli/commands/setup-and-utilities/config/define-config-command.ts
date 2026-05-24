import { defineCliCommand } from '~/cli/native'
import { configCommandFlags } from '~/cli/flags'
import { resolveConfigPath, loadConfig } from './config-loader'
import { extractExplicitFlags, buildConfigPatchFromFlags, deepMergeConfig } from './config-merge'
import { writeConfig } from './config-writer'
import * as l from '~/utils/logger'
import {
  normalizeGenericTtsOptionFlags,
  normalizeWriteStepSelectorFlags
} from '~/cli/commands/process-steps/service-selector-normalization'

export const configCommand = defineCliCommand({
  name: 'config',
  description: 'View or set default CLI options saved to config/autoshow.json',
  flags: configCommandFlags,
  help: {
    examples: [
      ['bun as config --show', 'Print current config'],
      ['bun as config --llm openai=gpt-5.4 --stt whisper=base', 'Set default LLM and STT model'],
      ['bun as config --reset', 'Clear all saved config']
    ]
  }
}, async (ctx) => {
  const flags = ctx.flags
  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const resolvedPath = await resolveConfigPath(configPathOverride)

  if (flags['show'] === true) {
    const config = await loadConfig(resolvedPath)
    l.write('info', `Config path: ${resolvedPath}`)
    l.write('info', JSON.stringify(config, null, 2))
    return
  }

  if (flags['reset'] === true) {
    await writeConfig(resolvedPath, {})
    l.write('success', `Config reset: ${resolvedPath}`)
    return
  }

  const preprocessedArgv = Bun.argv.slice(2)
  const explicitFlagNames = extractExplicitFlags(preprocessedArgv)
  const selectorNormalized = normalizeWriteStepSelectorFlags(flags as Record<string, unknown>, explicitFlagNames, preprocessedArgv)
  const ttsNormalized = normalizeGenericTtsOptionFlags(selectorNormalized.flags, selectorNormalized.explicitFlags)
  const patch = buildConfigPatchFromFlags(
    ttsNormalized.flags,
    ttsNormalized.explicitFlags,
    selectorNormalized.rawArgs ?? preprocessedArgv
  )

  if (Object.keys(patch).length === 0) {
    l.write('info', `No changes to write. Config path: ${resolvedPath}`)
    l.write('info', 'Use --show to print current config or --reset to clear it.')
    return
  }

  const current = await loadConfig(resolvedPath)
  const updated = deepMergeConfig(current as Record<string, unknown>, patch)
  await writeConfig(resolvedPath, updated)
  l.write('success', `Config saved to ${resolvedPath}`)
})
