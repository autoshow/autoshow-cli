import { defineCliCommand } from '~/cli/native'
import { CLIUsageError } from '~/utils/error-handler'
import { characterSketchCommand } from './commands/character-sketch/character-sketch-command'
import { draftScenesCommand } from './commands/draft-scenes/draft-scenes-command'
import { generateImagesCommand } from './commands/generate-images/generate-images-command'
import {
  CHARACTER_SKETCH_COMMAND,
  DRAFT_SCENES_COMMAND,
  GENERATE_IMAGES_COMMAND,
  HELP_TEXT,
  parseCharacterSketchArgs,
  parseDraftScenesArgs,
  parseGenerateImagesArgs,
} from './utils/cli-args'
import { resolveComicScriptReference, resolveSceneSlug } from './utils/project-paths'
import {
  estimateCharacterSketchPrice,
  estimateDraftScenesPrice,
  estimateGenerateImagesPrice,
} from './utils/price-estimate'

type ComicSubcommandDefinition = {
  name: string
  description: string
  run: (rawArgs: string[]) => Promise<void>
}

const PUBLIC_COMIC_COMMANDS = [
  DRAFT_SCENES_COMMAND,
  GENERATE_IMAGES_COMMAND,
  CHARACTER_SKETCH_COMMAND,
] as const

const NATIVE_BOOLEAN_FLAGS_TO_STRIP = new Set([
  '--allow-over-budget',
  '--verbose',
  '--quiet',
  '--json',
  '-q',
])
const NATIVE_VALUE_FLAGS_TO_STRIP = new Set(['--config-path'])

const printComicHelp = (): void => {
  console.log(HELP_TEXT)
}

const parseArgsOrUsage = <T>(parse: () => T): T => {
  try {
    return parse()
  } catch (error) {
    throw CLIUsageError(error instanceof Error ? error.message : String(error))
  }
}

const resolveComicScriptReferenceOrUsage = async (scriptReference: string): Promise<string> => {
  try {
    return await resolveComicScriptReference(scriptReference)
  } catch (error) {
    throw CLIUsageError(error instanceof Error ? error.message : String(error))
  }
}

const stripNativeGlobalFlags = (rawArgs: string[]): string[] => {
  const args: string[] = []

  for (let index = 0; index < rawArgs.length; index++) {
    const arg = rawArgs[index] as string
    if (NATIVE_BOOLEAN_FLAGS_TO_STRIP.has(arg) || arg.startsWith('--allow-over-budget=')) {
      continue
    }
    if (NATIVE_VALUE_FLAGS_TO_STRIP.has(arg)) {
      index++
      continue
    }
    if (arg.startsWith('--config-path=')) {
      continue
    }
    args.push(arg)
  }

  return args
}

const comicSubcommands = [
  {
    name: DRAFT_SCENES_COMMAND,
    description: 'Run script markdown to structured script JSON to draft prompt bundles to scene JSON to panel prompt bundles',
    run: async (rawArgs) => {
      const parsed = parseArgsOrUsage(() => parseDraftScenesArgs(rawArgs))
      if (parsed.showHelp) {
        printComicHelp()
        return
      }
      if (!parsed.scriptPath) {
        throw CLIUsageError('Missing script path. Usage: bun as comic draft-scenes <script-path>')
      }
      const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
      const sceneSlug = resolveSceneSlug(scriptPath)
      const options = { ...parsed, scriptPath, sceneSlug }
      if (parsed.price) {
        await estimateDraftScenesPrice(options)
        return
      }
      await draftScenesCommand(options)
    },
  },
  {
    name: GENERATE_IMAGES_COMMAND,
    description: 'Run panel prompt bundles to review sketches and/or final panel images',
    run: async (rawArgs) => {
      const parsed = parseArgsOrUsage(() => parseGenerateImagesArgs(rawArgs))
      if (parsed.showHelp) {
        printComicHelp()
        return
      }
      if (!parsed.scriptPath) {
        throw CLIUsageError('Missing script path. Usage: bun as comic generate-images <script-path>')
      }
      const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
      const sceneSlug = resolveSceneSlug(scriptPath)
      const options = { ...parsed, scriptPath, sceneSlug }
      if (parsed.price) {
        await estimateGenerateImagesPrice(options)
        return
      }
      await generateImagesCommand(options)
    },
  },
  {
    name: CHARACTER_SKETCH_COMMAND,
    description: 'Generate 3 outline-only character sketch refs, or combine a sketch directory into one sheet',
    run: async (rawArgs) => {
      const { showHelp, price, ...options } = parseArgsOrUsage(() => parseCharacterSketchArgs(rawArgs))
      if (showHelp) {
        printComicHelp()
        return
      }
      if (price) {
        await estimateCharacterSketchPrice(options)
        return
      }
      await characterSketchCommand(options)
    },
  },
] as const satisfies readonly ComicSubcommandDefinition[]

const comicSubcommandMap = new Map<string, ComicSubcommandDefinition>(
  comicSubcommands.map(command => [command.name, command])
)

const formatPublicSubcommands = (): string => PUBLIC_COMIC_COMMANDS.join(', ')

const dispatchComicSubcommand = async (rawArgs: string[]): Promise<void> => {
  const subcommand = rawArgs[0]
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    printComicHelp()
    return
  }

  if (subcommand === 'help') {
    printComicHelp()
    return
  }

  if (subcommand.startsWith('-')) {
    throw CLIUsageError(
      `Missing comic subcommand before "${subcommand}". Use one of: ${formatPublicSubcommands()}`
    )
  }

  const command = comicSubcommandMap.get(subcommand)
  if (!command) {
    throw CLIUsageError(`Unknown comic subcommand "${subcommand}". Use one of: ${formatPublicSubcommands()}`)
  }

  await command.run(rawArgs.slice(1))
}

export const comicCommand = defineCliCommand({
  name: 'comic',
  description: 'Generate USS Acampo comic scenes, sketches, and panel images',
  parameters: [{ key: '[subcommand...]', description: 'Comic subcommand and its flags' }],
  allowUnknownFlags: true,
  allowExcessParameters: true,
  passThroughHelpAfterFirstPositional: true,
  help: {
    examples: [
      ['bun as comic draft-scenes 05-01', 'Draft structured scene JSON'],
      ['bun as comic draft-scenes input/episode-scripts/05-script/01-paddy-goes-on-vacation.md --only panel-prompts', 'Build panel prompt bundles'],
      ['bun as comic generate-images 05-01 --panels-per-image 6', 'Generate page images'],
      ['bun as comic character-sketch --image input/characters/03-duco.webp', 'Generate character sketch references'],
      ['bun as comic draft-scenes --help', 'Show comic subcommand help']
    ],
    notes: [
      'Comic artifacts are read from input and written under output.'
    ]
  }
}, async (ctx) => {
  await dispatchComicSubcommand(stripNativeGlobalFlags(ctx.argv.slice(1)))
})
