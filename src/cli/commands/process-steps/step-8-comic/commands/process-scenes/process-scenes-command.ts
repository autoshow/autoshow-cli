import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { l, err } from '../../utils/logger'
import {
  findCharacterReferenceNamesInText,
  getCharacterImageFilename,
  getCharacters,
  isCharacterEntry,
  resolveCharacterReferenceName,
  stripVoiceOverSuffix,
} from './character-utils'
import {
  findExistingPanelImages,
  getPanelPromptTemplate,
  loadPromptsConfig,
  validatePanelNumberSequence,
} from '../../utils/scene-utils'
import { ScenePromptDataSchema, ExpandedScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { getPanelPromptCoverageReportPath, getStructuredScriptPath } from '../../utils/project-paths'
import { parseJsonFile } from '../../utils/json-prompt-utils'
import {
  assertSourceCoverageReportComplete,
  formatSourceSegmentsMarkdown,
  resolvePanelSourceSegments,
  validateSceneSourceSegmentCoverage,
  verifySourceSegmentCoverageInPromptFiles,
  writePanelPromptCoverageReport,
} from '../../utils/source-coverage-utils'


export type ProcessSceneOptions = {
  sceneSlug: string
  sceneJsonPath: string
  outputDir: string
}

const getPanelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`

export const processScene = async ({
  sceneSlug,
  sceneJsonPath,
  outputDir,
}: ProcessSceneOptions): Promise<{ success: number; errors: number }> => {
  const stats = { success: 0, errors: 0 }

  try {
    const prompts = await loadPromptsConfig()
    const scenePrompts = prompts["Scene Prompts"]
    const prefix = scenePrompts["Prefix"] || ''

    const sceneContent = await Bun.file(sceneJsonPath).text()
    if (!sceneContent.trim()) {
      throw new Error(`Scene JSON file is empty: ${sceneJsonPath}`)
    }

    const sceneData = v.parse(ScenePromptDataSchema, JSON.parse(sceneContent))
    const structuredScript = await parseJsonFile(
      getStructuredScriptPath(sceneSlug),
      StructuredScriptDataSchema,
    )
    validatePanelNumberSequence(sceneData.title, sceneData.panels)
    validateSceneSourceSegmentCoverage(sceneData, structuredScript.sourceSegments)

    await mkdir(outputDir, { recursive: true })

    const promptFiles = await Promise.all(sceneData.panels.map(async (currentPanel, index) => {
      const panelNum = index + 1
      const panelDirectoryName = getPanelDirectoryName(panelNum)
      const panelDirectory = join(outputDir, panelDirectoryName)
      await mkdir(panelDirectory, { recursive: true })
      await Bun.write(join(panelDirectory, '.keep'), '')

      const promptTemplate = getPanelPromptTemplate(scenePrompts, panelNum)
      const fullPrompt = prefix ? `${prefix}\n\n${promptTemplate}` : promptTemplate
      const panelFilename = `${sceneSlug}-panel-${panelNum}.md`

      let panelContent = `${fullPrompt}\n\n`

      if (index > 0) {
        for (let previousPanelNumber = 1; previousPanelNumber <= index; previousPanelNumber++) {
          const existingPanels = await findExistingPanelImages(sceneSlug, previousPanelNumber)
          for (const existingPanel of existingPanels) {
            const destFilename = existingPanel.split('/').pop() ?? ''
            await Bun.write(join(panelDirectory, destFilename), Bun.file(existingPanel))

            panelContent += `## Panel ${previousPanelNumber} (for reference)\n\n![Panel ${previousPanelNumber}](${destFilename})\n\n`
          }
        }
      }

      const panelCharacterNames = new Set<string>()
      const referenceCharacterNames = new Set<string>()
      const sourceSegments = resolvePanelSourceSegments(
        currentPanel.sourceSegmentIds,
        structuredScript.sourceSegments,
      )

      currentPanel.characters.forEach(name => {
        if (typeof name === 'string' && isCharacterEntry(name)) {
          const resolvedName = resolveCharacterReferenceName(name)
          panelCharacterNames.add(resolvedName)
          referenceCharacterNames.add(resolvedName)
        }
      })

      findCharacterReferenceNamesInText(currentPanel.description).forEach(name => {
        panelCharacterNames.add(name)
        referenceCharacterNames.add(name)
      })

      if (currentPanel.speech && Array.isArray(currentPanel.speech)) {
        currentPanel.speech.forEach(speech => {
          if (speech.character && isCharacterEntry(speech.character)) {
            referenceCharacterNames.add(resolveCharacterReferenceName(stripVoiceOverSuffix(speech.character)))
          }
        })
      }

      sourceSegments.forEach(segment => {
        findCharacterReferenceNamesInText([
          segment.speaker,
          segment.speakerLabel,
          segment.text,
        ].filter(Boolean).join('\n')).forEach(name => {
          referenceCharacterNames.add(name)
        })
      })

      const relevantCharacters = await getCharacters(Array.from(panelCharacterNames))
      const referenceCharacters = await getCharacters(Array.from(referenceCharacterNames))

      const expandedPanel = {
        ...currentPanel,
        number: panelNum,
        characters: relevantCharacters,
        sourceSegments,
      }

      const expandedSceneData = v.parse(ExpandedScenePromptDataSchema, {
        title: sceneData.title,
        location: sceneData.location,
        panels: [expandedPanel]
      })

      const imageFiles = new Set<string>()
      referenceCharacters.forEach(char => {
        imageFiles.add(char.image)
        char.sketchImages?.forEach(sketchImage => {
          imageFiles.add(sketchImage)
        })
      })

      await Promise.all(Array.from(imageFiles).map(async imagePath => {
        const filename = getCharacterImageFilename(imagePath)
        await Bun.write(join(panelDirectory, filename), Bun.file(imagePath))
      }))

      panelContent += `${formatSourceSegmentsMarkdown(sourceSegments)}\n\n`
      panelContent += `\`\`\`json\n${JSON.stringify(expandedSceneData, null, 2)}\n\`\`\``
      const promptPath = join(panelDirectory, panelFilename)
      await Bun.write(promptPath, panelContent)

      return {
        path: promptPath,
        content: panelContent,
      }
    }))

    const coverageReport = verifySourceSegmentCoverageInPromptFiles(
      structuredScript.sourceSegments,
      promptFiles,
    )
    await writePanelPromptCoverageReport(sceneSlug, coverageReport)
    assertSourceCoverageReportComplete(coverageReport)

    stats.success++
    l.dim(`  Processed: ${sceneSlug}`)
    l.dim(
      `  Source coverage: ${coverageReport.coveredSegments}/${coverageReport.totalSegments} ` +
      `segment(s), report: ${getPanelPromptCoverageReportPath(sceneSlug)}`
    )

  } catch (error) {
    stats.errors++
    if (v.isValiError(error)) {
      err(error)
    } else {
      err('Fatal error:', error instanceof Error ? error.message : String(error))
    }
    throw error
  }

  return stats
}
