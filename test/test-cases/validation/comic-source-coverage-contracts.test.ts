import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getPanelPromptCoverageReportPath,
  getPanelPromptsDirectory,
  getSceneJsonPath,
  getSceneOutputDirectory,
  getStructuredScriptPath,
} from '~/cli/commands/process-steps/step-8-comic/utils/project-paths'
import { processScene } from '~/cli/commands/process-steps/step-8-comic/commands/process-scenes/process-scenes-command'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/utils/structured-script-utils'
import {
  assertSourceCoverageReportComplete,
  formatSourceSegmentsMarkdown,
  validateSceneSourceSegmentCoverage,
  verifySourceSegmentCoverageInPromptFiles,
} from '~/cli/commands/process-steps/step-8-comic/utils/source-coverage-utils'
import { writeGeneratedImage } from '~/cli/commands/process-steps/step-8-comic/image-services/image-writer'
import { combineCharacterSketchSheet } from '~/cli/commands/process-steps/step-8-comic/commands/character-sketch/character-sketch-sheet'
import { CHARACTER_SKETCH_VIEWS } from '~/cli/commands/process-steps/step-8-comic/commands/process-scenes/character-utils'
import type {
  ScenePromptData,
  StructuredScriptData,
  StructuredScriptSourceSegment,
} from '~/cli/commands/process-steps/step-8-comic/types'

const episode5ScriptPath = 'input/episode-scripts/ep05-scripts/01-paddy-goes-on-vacation.md'
const comicSourceRoot = 'src/cli/commands/process-steps/step-8-comic'
const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const redDotPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
  0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99,
  0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

type BunImageCodec = {
  webp: () => BunImageEncoded
  jpeg: () => BunImageEncoded
}

type BunImageEncoded = {
  bytes: () => Promise<Uint8Array>
}

const getBunImageCodec = (): new (source: Uint8Array) => BunImageCodec => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: Uint8Array) => BunImageCodec }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image writer contracts')
  }
  return imageConstructor
}

const collectTypeScriptFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return await collectTypeScriptFiles(fullPath)
    }
    return entry.isFile() && fullPath.endsWith('.ts') ? [fullPath] : []
  }))
  return nested.flat()
}

const sampleSourceSegments: StructuredScriptSourceSegment[] = [
  {
    id: 'beat-0001',
    type: 'narration',
    text: 'The screen is black. A machine wakes up.',
    beatIndex: 1,
  },
  {
    id: 'beat-0002',
    type: 'dialogue',
    text: 'C’mon man, wake up, your vacation doesn’t start until tomorrow.',
    beatIndex: 2,
    speaker: 'Duco',
    speakerLabel: 'DUCO',
    delivery: 'chuckling',
  },
]

const buildSceneData = (sourceSegmentIds: string[]): ScenePromptData => ({
  title: 'Coverage Test',
  location: 'USS ACAMPO',
  panels: [{
    number: 1,
    description: 'Paddy works through a quiet ship corridor.',
    characters: [],
    speech: [],
    sourceSegmentIds,
  }],
})

describe('comic source coverage contracts', () => {
  test('comic source does not import OpenAI or Gemini SDK packages', async () => {
    const files = await collectTypeScriptFiles(comicSourceRoot)

    for (const file of files) {
      const source = await Bun.file(file).text()
      expect(source).not.toMatch(/from ['"](?:openai|openai\/|@google\/genai)/)
      expect(source).not.toMatch(/import\s+OpenAI\s+from ['"]openai/)
      expect(source).not.toMatch(/GoogleGenAI/)
      expect(source).not.toMatch(/(?:from|import)\s*\(?['"]sharp/)
    }
  })

  test('generated WebP and JPEG images are normalized to PNG with Bun.Image', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-comic-image-writer-'))
    const Image = getBunImageCodec()
    const encodedImages: Array<{ mimeType: string; bytes: Uint8Array; name: string }> = [
      { mimeType: 'image/webp', bytes: await new Image(redDotPng).webp().bytes(), name: 'webp' },
      { mimeType: 'image/jpeg', bytes: await new Image(redDotPng).jpeg().bytes(), name: 'jpeg' },
    ]

    try {
      for (const encoded of encodedImages) {
        const outputPath = join(dir, `${encoded.name}.png`)
        await writeGeneratedImage(outputPath, Buffer.from(encoded.bytes).toString('base64'), encoded.mimeType)
        const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())

        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('character sketch sheet composition uses ImageMagick without sharp', async () => {
    if (!Bun.which('magick') && !Bun.which('convert')) {
      return
    }

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-comic-sketch-sheet-'))

    try {
      const sources = await Promise.all(CHARACTER_SKETCH_VIEWS.map(async (view) => {
        const path = join(dir, `${view}.png`)
        await writeFile(path, redDotPng)
        return { view, path }
      }))
      const outputPath = join(dir, 'sheet.png')
      const dimensions = await combineCharacterSketchSheet({
        variant: 'canonical',
        outputPath,
        sources,
      })
      const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())

      expect(dimensions).toEqual({ width: 3, height: 1 })
      expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('structured parser preserves the Episode 5 opening source text and does not treat DUCO as the location', async () => {
    const script = await Bun.file(episode5ScriptPath).text()
    const structured = parseScriptMarkdownToStructuredData(script, episode5ScriptPath)
    const ducoBeat = structured.beats.find(beat => beat.speaker === 'Duco')
    const sourceText = structured.sourceSegments
      .map(segment => [
        segment.speakerLabel,
        segment.delivery,
        segment.text,
      ].filter(Boolean).join(' '))
      .join('\n')

    expect(structured.scene.location.raw).toBe('USS ACAMPO')
    expect(ducoBeat?.speakerLabel).toBe('DUCO')
    expect(ducoBeat?.delivery).toBe('chuckling')
    expect(ducoBeat?.text).toBe('C’mon man, wake up, your vacation doesn’t start until tomorrow.')
    expect(sourceText).toContain('The screen is black.')
    expect(sourceText).toContain('Montage. Deep inside a cramped access chute')
    expect(sourceText).toContain("Paddy's on a call.")
    expect(sourceText).toContain('I... don\'t wanna pay')
    expect(sourceText).toContain('DUCO')
    expect(sourceText).toContain('C’mon man, wake up')
  })

  test('structured parser maps CHAT script labels and mentions to the HR Hologram reference', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**USS ACAMPO**',
      '',
      '---',
      '',
      '## Hologram Check',
      '',
      '**INT. USS ACAMPO – FABRICATION BAY**',
      '',
      'CHAT’s interface flickers rapidly on the wall panel.',
      '',
      '**CHAT (V.O.)**',
      'I am only mostly broken.',
    ].join('\n'), 'input/test-chat-alias.md')

    const narrationBeat = structured.beats.find(beat => beat.text.includes('interface flickers'))
    const dialogueBeat = structured.beats.find(beat => beat.text === 'I am only mostly broken.')

    expect(structured.characters).toContain('HR Hologram')
    expect(narrationBeat?.characters).toEqual(['HR Hologram'])
    expect(narrationBeat?.rawMentions).toEqual([{
      raw: 'CHAT',
      characters: ['HR Hologram'],
    }])
    expect(dialogueBeat?.speaker).toBe('HR Hologram')
    expect(dialogueBeat?.speakerLabel).toBe('CHAT (V.O.)')
  })

  test('scene source segment coverage validation rejects missing and unknown IDs', () => {
    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001', 'beat-0002']),
      sampleSourceSegments,
    )).not.toThrow()

    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001']),
      sampleSourceSegments,
    )).toThrow(/missing 1 source segment.*beat-0002/)

    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001', 'beat-9999']),
      sampleSourceSegments,
    )).toThrow(/unknown source segment ID.*beat-9999/)
  })

  test('panel prompt packaging writes and verifies verbatim source segment coverage', async () => {
    const sceneSlug = `comic-source-coverage-${Date.now()}`
    const sceneOutputDirectory = getSceneOutputDirectory(sceneSlug)

    const structuredScript: StructuredScriptData = {
      scriptSlug: sceneSlug,
      sourceFile: 'input/test.md',
      document: {
        heading: 'Episode Test',
        title: 'Episode Test',
        metadata: [{ label: 'USS ACAMPO', raw: 'USS ACAMPO' }],
      },
      scene: {
        heading: 'COLD OPEN: "Coverage Test"',
        section: 'COLD OPEN',
        title: 'Coverage Test',
        location: { raw: 'USS ACAMPO' },
      },
      characters: [],
      beats: [],
      sourceSegments: sampleSourceSegments,
    }

    const sceneData: ScenePromptData = {
      title: 'Coverage Test',
      location: 'USS ACAMPO',
      panels: [
        {
          number: 1,
          description: 'The screen is black before the ship wakes.',
          characters: [],
          speech: [],
          sourceSegmentIds: ['beat-0001'],
        },
        {
          number: 2,
          description: 'Duco leans in, amused.',
          characters: [],
          speech: [{
            character: 'Duco',
            line: 'C’mon man, wake up, your vacation doesn’t start until tomorrow.',
            tone: 'chuckling',
          }],
          sourceSegmentIds: ['beat-0002'],
        },
      ],
    }

    try {
      await mkdir(sceneOutputDirectory, { recursive: true })
      await writeFile(getStructuredScriptPath(sceneSlug), JSON.stringify(structuredScript, null, 2))
      await writeFile(getSceneJsonPath(sceneSlug), JSON.stringify(sceneData, null, 2))

      await processScene({
        sceneSlug,
        sceneJsonPath: getSceneJsonPath(sceneSlug),
        outputDir: getPanelPromptsDirectory(sceneSlug),
      })

      const firstPrompt = await Bun.file(
        `${getPanelPromptsDirectory(sceneSlug)}/panel-01/${sceneSlug}-panel-1.md`
      ).text()
      const secondPrompt = await Bun.file(
        `${getPanelPromptsDirectory(sceneSlug)}/panel-02/${sceneSlug}-panel-2.md`
      ).text()
      const report = JSON.parse(await Bun.file(getPanelPromptCoverageReportPath(sceneSlug)).text()) as {
        complete: boolean
        coveredSegments: number
        totalSegments: number
      }
      const ducoSegment = sampleSourceSegments[1]!
      const ducoSpeakerLabel = ducoSegment.speakerLabel
      const ducoDelivery = ducoSegment.delivery

      if (!ducoSpeakerLabel || !ducoDelivery) {
        throw new Error('Sample Duco segment is missing speaker metadata')
      }

      expect(firstPrompt).toContain(sampleSourceSegments[0]!.text)
      expect(secondPrompt).toContain(ducoSpeakerLabel)
      expect(secondPrompt).toContain(ducoDelivery)
      expect(secondPrompt).toContain(ducoSegment.text)
      expect(report.complete).toBe(true)
      expect(report.coveredSegments).toBe(2)
      expect(report.totalSegments).toBe(2)
    } finally {
      await rm(sceneOutputDirectory, { recursive: true, force: true })
    }
  })

  test('panel prompt packaging resolves legacy CHAT panel text to the HR Hologram image reference', async () => {
    const sceneSlug = `comic-chat-reference-${Date.now()}`
    const sceneOutputDirectory = getSceneOutputDirectory(sceneSlug)
    const sourceSegments: StructuredScriptSourceSegment[] = [{
      id: 'beat-0001',
      type: 'narration',
      text: 'A tired CHAT hologram appears beside GeeBee.',
      beatIndex: 1,
    }]
    const structuredScript: StructuredScriptData = {
      scriptSlug: sceneSlug,
      sourceFile: 'input/test.md',
      document: {
        heading: 'Episode Test',
        title: 'Episode Test',
        metadata: [{ label: 'USS ACAMPO', raw: 'USS ACAMPO' }],
      },
      scene: {
        heading: 'Hologram Check',
        title: 'Hologram Check',
        location: { raw: 'USS ACAMPO' },
      },
      characters: ['HR Hologram', 'GeeBee'],
      beats: [],
      sourceSegments,
    }
    const sceneData: ScenePromptData = {
      title: 'Hologram Check',
      location: 'USS ACAMPO',
      panels: [{
        number: 1,
        description: 'A tired CHAT hologram appears beside GeeBee.',
        characters: [],
        speech: [],
        sourceSegmentIds: ['beat-0001'],
      }],
    }

    try {
      await mkdir(sceneOutputDirectory, { recursive: true })
      await writeFile(getStructuredScriptPath(sceneSlug), JSON.stringify(structuredScript, null, 2))
      await writeFile(getSceneJsonPath(sceneSlug), JSON.stringify(sceneData, null, 2))

      await processScene({
        sceneSlug,
        sceneJsonPath: getSceneJsonPath(sceneSlug),
        outputDir: getPanelPromptsDirectory(sceneSlug),
      })

      const panelDir = `${getPanelPromptsDirectory(sceneSlug)}/panel-01`
      const prompt = await Bun.file(`${panelDir}/${sceneSlug}-panel-1.md`).text()

      expect(existsSync(`${panelDir}/12-chat.webp`)).toBe(true)
      expect(prompt).toContain('"name": "HR Hologram"')
      expect(prompt).toContain('"image": "input/characters/12-chat.webp"')
    } finally {
      await rm(sceneOutputDirectory, { recursive: true, force: true })
    }
  })

  test('prompt coverage verifier fails when a source segment is omitted', () => {
    const report = verifySourceSegmentCoverageInPromptFiles(sampleSourceSegments, [{
      path: 'panel-01.md',
      content: formatSourceSegmentsMarkdown([sampleSourceSegments[0]!]),
    }])

    expect(report.complete).toBe(false)
    expect(report.missingSegments.map(segment => segment.id)).toEqual(['beat-0002'])
    expect(() => assertSourceCoverageReportComplete(report)).toThrow(/beat-0002/)
  })
})
