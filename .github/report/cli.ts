#!/usr/bin/env bun
/**
 * Report CLI - Generate and manage setup reports
 *
 * Commands:
 *   run <setup-command>    Run setup and generate report
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
import { listCommand } from './commands/list.ts'
import { viewCommand } from './commands/view.ts'
import { compareCommand } from './commands/compare.ts'
import { AVAILABLE_SETUP_COMMANDS } from './constants.ts'

const program = new Command()

program
  .name('report')
  .description('Generate and manage setup reports for autoshow-cli')
  .version('1.0.0')

// Run command
program
  .command('run <setup-command>')
  .description('Run a setup command and generate a detailed report')
  .option('--fresh', 'Remove marker files before running to force a complete setup')
  .option('--skip-test', 'Skip the post-setup test run')
  .option('--input <file>', 'Use a custom input file for the test run')
  .addHelpText(
    'after',
    `
Examples:
  $ bun .github/report/cli.ts run setup:tts:fish
  $ bun .github/report/cli.ts run setup:tts:qwen3 --fresh
  $ bun .github/report/cli.ts run setup:tts:chatterbox --skip-test
  $ bun .github/report/cli.ts run setup:tts:fish --input input/story.md

Available setup commands:
${AVAILABLE_SETUP_COMMANDS.map((cmd) => `  ${cmd}`).join('\n')}
`
  )
  .action(async (setupCommand: string, options) => {
    await runCommand(setupCommand, {
      fresh: options.fresh,
      skipTest: options.skipTest,
      input: options.input,
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
  $ bun .github/report/cli.ts run setup:tts:fish --input input/sample.md
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
