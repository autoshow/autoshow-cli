import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getDraftPromptPath,
  getPanelPromptCoverageReportPath,
  getPanelPromptsDirectory,
  getSceneJsonPath,
  getSceneOutputDirectory,
  getStructuredScriptPath,
} from '~/cli/commands/process-steps/step-8-comic/utils/project-paths'
import { processScene } from '~/cli/commands/process-steps/step-8-comic/commands/process-scenes/process-scenes-command'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/utils/structured-script-utils'
import { generateJsonPrompt } from '~/cli/commands/process-steps/step-8-comic/utils/json-prompt-utils'
import {
  isRecapMontageBeat,
  resolvePreviousEpisodeScriptsDirectory,
  validateSceneRecapMontageExpansion,
} from '~/cli/commands/process-steps/step-8-comic/utils/recap-montage-utils'
import {
  assertSourceCoverageReportComplete,
  formatSourceSegmentsMarkdown,
  validateSceneSourceSegmentCoverage,
  verifySourceSegmentCoverageInPromptFiles,
} from '~/cli/commands/process-steps/step-8-comic/utils/source-coverage-utils'
import { writeGeneratedImage } from '~/cli/commands/process-steps/step-8-comic/image-services/image-writer'
import { combineCharacterSketchSheet } from '~/cli/commands/process-steps/step-8-comic/commands/character-sketch/character-sketch-sheet'
import { composeComicGridPage } from '~/cli/commands/process-steps/step-8-comic/commands/generate-images/comic-grid-composer'
import { generateComicGridPages } from '~/cli/commands/process-steps/step-8-comic/commands/generate-images/generate-comic-grid-pages'
import { CHARACTER_SKETCH_VIEWS } from '~/cli/commands/process-steps/step-8-comic/commands/process-scenes/character-utils'
import type {
  ScenePromptData,
  StructuredScriptData,
  StructuredScriptSourceSegment,
} from '~/cli/commands/process-steps/step-8-comic/types'

const episode5ScriptPath = 'input/episode-scripts/05-script/01-paddy-goes-on-vacation.md'
const episode4RecapScriptPath = 'input/episode-scripts/04-script/01-previously-on-uss-acampo.md'
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

type BunImageMetadataReader = {
  metadata: () => Promise<{ width?: number | undefined; height?: number | undefined }>
}

const getBunImageCodec = (): new (source: Uint8Array) => BunImageCodec => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: Uint8Array) => BunImageCodec }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image writer contracts')
  }
  return imageConstructor
}

const getBunImageMetadataReader = (): new (source: ArrayBuffer) => BunImageMetadataReader => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: ArrayBuffer) => BunImageMetadataReader }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image metadata contracts')
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

const buildRecapSceneData = (panelCount: number, sourceSegmentId: string): ScenePromptData => ({
  title: 'Previously on USS Acampo',
  location: 'USS ACAMPO',
  panels: Array.from({ length: panelCount }, (_value, index) => ({
    number: index + 1,
    description: 'High-speed recap panel with motion blur, speed lines, and under 30 seconds pacing.',
    characters: [],
    speech: [],
    sourceSegmentIds: [sourceSegmentId],
  })),
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
      throw new Error('ImageMagick magick or convert is required for sketch sheet composition coverage')
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

  test('comic grid composition uses ImageMagick and leaves partial cells blank', async () => {
    if (!Bun.which('magick') && !Bun.which('convert')) {
      throw new Error('ImageMagick magick or convert is required for comic grid composition coverage')
    }

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-comic-grid-page-'))

    try {
      const sources = await Promise.all([1, 2, 3].map(async (panelNumber) => {
        const path = join(dir, `panel-${panelNumber}.png`)
        await writeFile(path, redDotPng)
        return path
      }))
      const outputPath = join(dir, 'page.png')
      const dimensions = await composeComicGridPage({
        sources,
        outputPath,
        grid: { columns: 2, rows: 2 },
        cellSize: { width: 1, height: 1 },
      })
      const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())
      const Image = getBunImageMetadataReader()
      const metadata = await new Image(await Bun.file(outputPath).arrayBuffer()).metadata()

      expect(dimensions).toEqual({ width: 2, height: 2 })
      expect(metadata.width).toBe(2)
      expect(metadata.height).toBe(2)
      expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('comic grid generation reports missing panel PNG paths before composition', async () => {
    const sceneSlug = `grid-missing-${Date.now()}`
    const sceneRoot = getSceneOutputDirectory(sceneSlug)
    const expectedPanelPath = join(sceneRoot, 'panels', 'panel-01.png')

    try {
      await mkdir(join(getPanelPromptsDirectory(sceneSlug), 'panel-01'), { recursive: true })

      await expect(generateComicGridPages(sceneSlug, {
        models: ['gpt-image-2'],
        force: false,
        panels: 'all',
        grid: { columns: 2, rows: 3 },
      }, {
        composeGridPage: async () => {
          throw new Error('compose should not run without panel PNGs')
        },
      })).rejects.toThrow(expectedPanelPath)
    } finally {
      await rm(sceneRoot, { recursive: true, force: true })
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

  test('structured parser treats lowercase action after a character label as narration', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**USS ACAMPO**',
      '',
      '---',
      '',
      '## Scene: "Action Label"',
      '',
      '**INT. STONE CELL - LATE NIGHT**',
      '',
      '**DUCO**',
      'walks up to the inside of the cell door. There, embedded just beside it, is a small **metallic horn**.',
      '',
      '**DUCO**',
      'Alright. Who here thinks they can scream like a prophet?',
      '',
      '**GULP**',
      '(softly)',
      'no it is not like that.',
    ].join('\n'), 'input/test-action-label.md')

    const actionBeat = structured.beats.find(beat => beat.text.includes('metallic horn'))
    const dialogueBeat = structured.beats.find(beat => beat.text.startsWith('Alright.'))
    const lowercaseDialogueBeat = structured.beats.find(beat => beat.text.startsWith('no it'))
    const actionSegment = structured.sourceSegments.find(segment => segment.text.includes('metallic horn'))

    expect(actionBeat?.type).toBe('narration')
    expect(actionBeat?.characters).toContain('Duco')
    expect(actionBeat?.speaker).toBeUndefined()
    expect(actionBeat?.speakerLabel).toBeUndefined()
    expect(actionSegment?.type).toBe('narration')
    expect(actionSegment?.speakerLabel).toBeUndefined()
    expect(dialogueBeat?.type).toBe('dialogue')
    expect(dialogueBeat?.speaker).toBe('Duco')
    expect(dialogueBeat?.speakerLabel).toBe('DUCO')
    expect(lowercaseDialogueBeat?.type).toBe('dialogue')
    expect(lowercaseDialogueBeat?.speaker).toBe('Gulp')
    expect(lowercaseDialogueBeat?.delivery).toBe('softly')
  })

  test('structured parser keeps compound speaker labels as dialogue', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**USS ACAMPO**',
      '',
      '---',
      '',
      '## Scene: "Compound Speaker"',
      '',
      '**EXT. CLEARING - DAY**',
      '',
      '**GULP AND GEEBEE**',
      '(in unison, not looking up)',
      'Almost done!',
    ].join('\n'), 'input/test-compound-speaker.md')

    const beat = structured.beats.find(entry => entry.text === 'Almost done!')
    const segment = structured.sourceSegments.find(entry => entry.text === 'Almost done!')

    expect(beat?.type).toBe('dialogue')
    expect(beat?.speaker).toBeUndefined()
    expect(beat?.speakerLabel).toBe('GULP AND GEEBEE')
    expect(beat?.characters).toEqual(['Gulp', 'GeeBee'])
    expect(beat?.delivery).toBe('in unison, not looking up')
    expect(segment?.type).toBe('dialogue')
    expect(segment?.speakerLabel).toBe('GULP AND GEEBEE')
  })

  test('structured parser keeps uncatalogued spoken labels as dialogue without inventing characters', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**USS ACAMPO**',
      '',
      '---',
      '',
      '## Scene: "Radio Speaker"',
      '',
      '**INT. SHUTTLE BAY - IN FLIGHT**',
      '',
      '**RADIO V.O.**',
      'And now those bozos in the URP lower parliament are asking for more funds for...',
    ].join('\n'), 'input/test-radio-speaker.md')

    const beat = structured.beats.find(entry => entry.text.startsWith('And now those bozos'))
    const segment = structured.sourceSegments.find(entry => entry.text.startsWith('And now those bozos'))

    expect(beat?.type).toBe('dialogue')
    expect(beat?.speaker).toBeUndefined()
    expect(beat?.speakerLabel).toBe('RADIO V.O.')
    expect(beat?.characters).toEqual([])
    expect(segment?.type).toBe('dialogue')
    expect(segment?.speakerLabel).toBe('RADIO V.O.')
  })

  test('recap montage resolver maps Episode 4 scripts to Episode 3 scripts', () => {
    expect(resolvePreviousEpisodeScriptsDirectory(episode4RecapScriptPath))
      .toBe(join('input', 'episode-scripts', '03-script'))
  })

  test('recap montage cue detection requires both episode and montage in the same beat', () => {
    expect(isRecapMontageBeat({
      text: 'Cue a rapid montage of Episode 3, every scene sped up.',
    })).toBe(true)

    expect(isRecapMontageBeat({
      text: 'Cue a rapid montage of prior chaos.',
    })).toBe(false)

    expect(isRecapMontageBeat({
      text: 'Episode 3 ended badly for everyone.',
    })).toBe(false)
  })

  test('draft prompt expands recap montage with all prior scene titles and exact panel count', async () => {
    const sceneSlug = `comic-recap-montage-${Date.now()}`
    const sceneOutputDirectory = getSceneOutputDirectory(sceneSlug)
    const script = await Bun.file(episode4RecapScriptPath).text()
    const structuredScript = {
      ...parseScriptMarkdownToStructuredData(script, episode4RecapScriptPath),
      scriptSlug: sceneSlug,
    }
    const priorSceneTitles = [
      'Work Smarter, Not Peaches',
      'Unaccounted For',
      'Gentle Capture',
      'Split the Difference',
      'The Magic Show Begins',
      'Not Forgotten',
      'Unrest',
    ]

    try {
      await mkdir(sceneOutputDirectory, { recursive: true })
      await writeFile(getStructuredScriptPath(sceneSlug), JSON.stringify(structuredScript, null, 2))

      await generateJsonPrompt(sceneSlug)

      const prompt = await Bun.file(getDraftPromptPath(sceneSlug)).text()
      expect(prompt).toContain('## Recap Montage Expansion')
      expect(prompt).toContain('Required recap montage panel count for `beat-0004`: exactly 7.')
      expect(prompt).toContain('Every recap montage panel must include `beat-0004` in `sourceSegmentIds`.')
      expect(prompt).toContain('Every recap montage panel must use `"speech": []`')
      expect(prompt).toContain('motion blur, speed lines, and under 30 seconds pacing')
      expect(prompt).toContain('Do not render the literal words "TEXT ON SCREEN"')
      priorSceneTitles.forEach(title => {
        expect(prompt).toContain(title)
      })
    } finally {
      await rm(sceneOutputDirectory, { recursive: true, force: true })
    }
  })

  test('scene validation rejects a one-panel recap when seven prior scenes are available', async () => {
    const script = await Bun.file(episode4RecapScriptPath).text()
    const structured = parseScriptMarkdownToStructuredData(script, episode4RecapScriptPath)

    await expect(validateSceneRecapMontageExpansion(
      buildRecapSceneData(1, 'beat-0004'),
      structured,
    )).rejects.toThrow(/beat-0004 appears in 1 panel\(s\).*7 prior scene\(s\)/)
  })

  test('scene validation accepts seven recap panels referencing the montage source segment', async () => {
    const script = await Bun.file(episode4RecapScriptPath).text()
    const structured = parseScriptMarkdownToStructuredData(script, episode4RecapScriptPath)

    await expect(validateSceneRecapMontageExpansion(
      buildRecapSceneData(7, 'beat-0004'),
      structured,
    )).resolves.toBeUndefined()
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

  test('draft prompt includes an explicit source segment ID checklist', async () => {
    const sceneSlug = `comic-source-checklist-${Date.now()}`
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

    try {
      await mkdir(sceneOutputDirectory, { recursive: true })
      await writeFile(getStructuredScriptPath(sceneSlug), JSON.stringify(structuredScript, null, 2))

      await generateJsonPrompt(sceneSlug)

      const prompt = await Bun.file(getDraftPromptPath(sceneSlug)).text()
      expect(prompt).toContain('## Required Source Segment ID Checklist')
      expect(prompt).toContain('- beat-0001 (narration, beat 1): The screen is black. A machine wakes up.')
      expect(prompt).toContain('- beat-0002 (dialogue, beat 2): C’mon man, wake up')
      expect(prompt).toContain('verify that every exact ID below appears in at least one panel')
    } finally {
      await rm(sceneOutputDirectory, { recursive: true, force: true })
    }
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
