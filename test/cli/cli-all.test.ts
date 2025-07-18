// test/cli/cli-all.test.ts

import test from 'node:test'
import { strictEqual } from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const commands = [
  {
    cmd: 'npm run as -- text --file "content/examples/audio.mp3" --prompt titles summary',
    expectedFile: 'audio-prompt.md',
    newName: '02-ALL-01-file-multiple-prompts.md'
  },
  {
    cmd: 'npm run as -- text --file "content/examples/audio.mp3" --chatgpt',
    expectedFile: 'audio-chatgpt-shownotes.md',
    newName: '02-ALL-02-chatgpt-default.md'
  },
  {
    cmd: 'npm run as -- text --file "content/examples/audio.mp3" --claude',
    expectedFile: 'audio-claude-shownotes.md',
    newName: '02-ALL-03-claude-default.md'
  },
  {
    cmd: 'npm run as -- text --file "content/examples/audio.mp3" --gemini',
    expectedFile: 'audio-gemini-shownotes.md',
    newName: '02-ALL-04-gemini-shownotes.md'
  },
  {
    cmd: 'npm run as -- text --file "content/examples/audio.mp3" --deepgram',
    expectedFile: 'audio-prompt.md',
    newName: '02-ALL-05-deepgram-prompt.md'
  },
  {
    cmd: 'npm run as -- text --file "content/examples/audio.mp3" --assembly',
    expectedFile: 'audio-prompt.md',
    newName: '02-ALL-06-assembly-prompt.md'
  },
  {
    cmd: 'npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr"',
    expectedFiles: [
      { file: '2024-09-24-ep1-fsjam-podcast-prompt.md', newName: '02-ALL-07-playlist-default.md' },
      { file: '2024-09-24-ep0-fsjam-podcast-prompt.md', newName: '02-ALL-08-playlist-default.md' }
    ]
  },
  {
    cmd: 'npm run as -- text --urls "content/examples/example-urls.md"',
    expectedFiles: [
      { file: '2024-09-24-ep1-fsjam-podcast-prompt.md', newName: '02-ALL-09-urls-default.md' },
      { file: '2024-09-24-ep0-fsjam-podcast-prompt.md', newName: '02-ALL-10-urls-default.md' }
    ]
  },
  {
    cmd: 'npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --info',
    expectedFile: 'fsjam_info.json',
    newName: '02-ALL-11-fsjam-info.json',
  },
  {
    cmd: 'npm run as -- text --urls "content/examples/example-urls.md" --info',
    expectedFile: 'urls_info.json',
    newName: '02-ALL-12-urls-info.json',
  },
]

test('AutoShow Command Tests', async (t) => {
  for (const [index, command] of commands.entries()) {
    await t.test(`should run command ${index + 1} successfully`, async () => {
      execSync(command.cmd, { stdio: 'inherit' })

      if (Array.isArray(command.expectedFiles)) {
        for (const { file, newName } of command.expectedFiles) {
          const filePath = join('content', file)
          strictEqual(existsSync(filePath), true, `Expected file ${file} was not created`)
          const newPath = join('content', newName)
          renameSync(filePath, newPath)
          strictEqual(existsSync(newPath), true, `File was not renamed to ${newName}`)
        }
      } else {
        const filePath = join('content', command.expectedFile as string)
        strictEqual(existsSync(filePath), true, `Expected file ${command.expectedFile} was not created`)
        const newPath = join('content', command.newName as string)
        renameSync(filePath, newPath)
        strictEqual(existsSync(newPath), true, `File was not renamed to ${command.newName}`)
      }
    })
  }
})