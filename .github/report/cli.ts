#!/usr/bin/env bun
/**
 * Report CLI - Generate and manage setup/runtime reports
 *
 * Commands:
 *   setup <setup-command>  Run setup/download timing report (TTS only)
 *   runtime <setup-command> Run warm-up + measured runtime report (TTS only)
 *   run <setup-command>    Legacy combined setup+test report
 *   list                   List report types or existing reports
 *   view <name>            View a specific report
 *   compare <r1> <r2>      Compare two reports
 *
 * Examples:
 *   bun .github/report/cli.ts run setup:tts:fish --input input/sample.md
 *   bun .github/report/cli.ts list --reports
 *   bun .github/report/cli.ts view tts-fish-sample-2026-01-30
 *   bun .github/report/cli.ts compare tts-fish-sample tts-qwen3-sample
 */

import { Command } from 'commander'
import { runCommand } from './commands/run.ts'
import { setupCommand } from './commands/setup.ts'
import { runtimeCommand } from './commands/runtime.ts'
import { listCommand } from './commands/list.ts'
import { viewCommand } from './commands/view.ts'
import { compareCommand } from './commands/compare.ts'
import { AVAILABLE_SETUP_COMMANDS } from './constants.ts'

const program = new Command()

program
  .name('report')
  .description('Generate and manage setup/runtime reports for autoshow-cli')
  .version('1.0.0')

// Run command
program
  .command('setup <setup-command>')
  .description('Run setup/model-download timing report (TTS commands only)')
  .option('--fresh', 'Remove marker files before running to force a complete setup')
  .option('--model <model>', 'Model to use for setup/model preparation')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts setup setup:tts:qwen3 --fresh
  $ bun .github/report/cli.ts setup setup:tts:chatterbox --model standard
  $ bun .github/report/cli.ts setup setup:tts:fish --model s1-mini
`
  )
  .action(async (setupCommandName: string, options) => {
    await setupCommand(setupCommandName, {
      fresh: options.fresh,
      model: options.model,
    })
  })

program
  .command('runtime <setup-command>')
  .description('Run ready-to-go runtime timing report (warm-up + measured, TTS commands only)')
  .option('--input <file>', 'Use a custom input file for runtime measurements')
  .option('--model <model>', 'Model to use for runtime measurements')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts runtime setup:tts:qwen3 --input input/sample.md
  $ bun .github/report/cli.ts runtime setup:tts:cosyvoice --model CosyVoice-300M-Instruct
`
  )
  .action(async (setupCommandName: string, options) => {
    await runtimeCommand(setupCommandName, {
      input: options.input,
      model: options.model,
    })
  })

program
  .command('run <setup-command>')
  .description('Legacy: run setup and optional post-setup test in one combined report')
  .option('--fresh', 'Remove marker files before running to force a complete setup')
  .option('--skip-test', 'Skip the post-setup test run')
  .option('--input <file>', 'Use a custom input file for the test run')
  .option('--model <model>', 'Model to use for the test run (e.g., turbo, base, Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice)')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts run setup:tts:fish
  $ bun .github/report/cli.ts run setup:tts:qwen3 --fresh
  $ bun .github/report/cli.ts run setup:tts:chatterbox --skip-test
  $ bun .github/report/cli.ts run setup:tts:fish --input input/story.md
  $ bun .github/report/cli.ts run setup:tts:chatterbox --model turbo
  $ bun .github/report/cli.ts run setup:tts:qwen3 --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice

Available setup commands:
${AVAILABLE_SETUP_COMMANDS.map((cmd) => `  ${cmd}`).join('\n')}
`
  )
  .action(async (setupCommand: string, options) => {
    await runCommand(setupCommand, {
      fresh: options.fresh,
      skipTest: options.skipTest,
      input: options.input,
      model: options.model,
    })
  })

// List command
program
  .command('list')
  .description('List available report types or existing reports')
  .option('--reports', 'List existing reports instead of report types')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts list            # List available setup commands
  $ bun .github/report/cli.ts list --reports  # List existing reports
  $ bun .github/report/cli.ts list --reports --json
`
  )
  .action(async (options) => {
    await listCommand({
      reports: options.reports,
      json: options.json,
    })
  })

// View command
program
  .command('view <name>')
  .description('View a specific report')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as Markdown')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts view tts-fish-sample-2026-01-30
  $ bun .github/report/cli.ts view fish --json
  $ bun .github/report/cli.ts view qwen3 --markdown
`
  )
  .action(async (name: string, options) => {
    await viewCommand(name, {
      json: options.json,
      markdown: options.markdown,
    })
  })

// Compare command
program
  .command('compare <report1> <report2>')
  .description('Compare two reports')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as Markdown')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts compare tts-fish-sample tts-qwen3-sample
  $ bun .github/report/cli.ts compare fish qwen3 --json
  $ bun .github/report/cli.ts compare fish qwen3 --markdown
`
  )
  .action(async (report1: string, report2: string, options) => {
    await compareCommand(report1, report2, {
      json: options.json,
      markdown: options.markdown,
    })
  })

// Add global help text
program.addHelpText(
  'after',
  `
Quick Start:
  $ bun .github/report/cli.ts setup setup:tts:qwen3 --fresh
  $ bun .github/report/cli.ts runtime setup:tts:qwen3 --input input/sample.md
  $ bun .github/report/cli.ts run setup:tts:fish --input input/sample.md  # legacy
  $ bun .github/report/cli.ts list --reports
  $ bun .github/report/cli.ts view <report-name>

Reports are saved to the 'reports/' directory in both JSON and Markdown formats.
`
)

// Handle unknown commands
program.on('command:*', () => {
  console.error(`Error: Invalid command '${program.args.join(' ')}'.`)
  console.error('Use --help to see available commands.')
  process.exit(1)
})

// Parse arguments
program.parse(process.argv)

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help()
}
