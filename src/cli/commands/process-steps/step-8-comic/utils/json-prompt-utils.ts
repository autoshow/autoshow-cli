import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import { err, comicLog } from './logger'
import { CHARACTER_NAMES, CHARACTER_REFERENCE_ALIASES, StructuredScriptDataSchema } from '../schemas/schemas'
import { getStructuredScriptPath, getDraftPromptPath } from './project-paths'
import {
  formatRecapMontagePromptSection,
  resolveRecapMontageExpansions,
  type RecapMontageExpansion,
} from './recap-montage-utils'
import type { StructuredScriptData } from '../types/comic-types'



export const parseJsonFile = async <T>(
  filePath: string,
  schema: v.GenericSchema<T>
): Promise<T> => {
  try {
    const content = await Bun.file(filePath).text()
    const data = JSON.parse(content)
    return v.parse(schema, data)
  } catch (error) {
    if (v.isValiError(error)) {
      err(error)
      throw new Error(`Invalid data in ${filePath}`)
    }
    throw error
  }
}

const VALID_CHARACTER_NAMES = CHARACTER_NAMES.map(name => `- ${name}`).join('\n')
const CHARACTER_ALIAS_GUIDANCE = Object.entries(CHARACTER_REFERENCE_ALIASES)
  .map(([alias, character]) => `- ${alias} -> ${character}`)
  .join('\n')

const JSON_PROMPT_TEMPLATE = `# Convert Structured Script to Comic Panel JSON

Please convert the structured script JSON above into a JSON file with comic book panel descriptions. Follow these guidelines:

## Structured Script Guidance:
1. Treat the structured script JSON as canonical source material for the scene
2. Preserve the exact order of the \`beats\` array when deciding panel pacing
3. Every \`dialogue\` beat's \`text\` must be copied exactly into panel speech without rewriting it
4. Use \`delivery\` as acting/tone context; only surface it in \`speech[].tone\` when it is genuinely helpful
5. Use \`narration\`, \`direction\`, and \`transition\` beats to drive visual descriptions, timing, and scene flow
6. Use the canonical names from \`characters\` and \`rawMentions\` instead of inventing new name variants
7. Treat \`sourceSegments\` as the complete coverage checklist for source script text

## Important Rules:
1. **Follow the dialogue exactly** - Use the exact dialogue from structured \`dialogue\` beats without any changes
2. **Follow stage directions closely** - Convert \`narration\`, \`direction\`, and \`transition\` beats into visual panel descriptions
3. **Create natural panel breaks** - Break scenes into panels at natural dramatic or comedic beats
4. **Include all characters** - Ensure all characters mentioned in the scene are accounted for in panel descriptions
5. **Visual storytelling** - Describe visual elements, expressions, body language, and positioning clearly
6. **Maximum 5 characters per panel** - No more than 5 characters should be featured in a single panel at once
7. **Single speaker per panel** - Only one character should have a speech bubble per panel
8. **Use exact character names** - Character names must exactly match the valid names listed below
9. **Every panel must include a characters array** - Use an explicit \`characters\` array on every panel, even when it is empty
10. **Panel numbers must be sequential** - Start at \`1\` and increment by \`1\` for each panel
11. **Every panel must include \`sourceSegmentIds\`** - Assign each panel the exact source segment IDs it represents
12. **Cover every source segment ID at least once** - Do not omit, invent, or rewrite IDs from \`sourceSegments\`
13. **Treat \`TEXT ON SCREEN\` as a directive** - Do not render the literal words "TEXT ON SCREEN"; render only authored on-screen text that follows the directive

## Valid Character Names:
The character references in "speech" and panel "characters" arrays must use these exact names:
${VALID_CHARACTER_NAMES}

**Note:** Do not use variations like "Captain Peaches", "DUCO", "Gulp Shiddo", "Lieutenant GeeBee", "Ensign Seamus", etc. Use only the exact names from the list above.

## Character Aliases:
When source text uses these aliases, use the canonical character name in "speech" and panel "characters" arrays:
${CHARACTER_ALIAS_GUIDANCE}

## JSON Schema Example:

\`\`\`json
{
  "title": "SCENE TITLE FROM SCRIPT",
  "location": "LOCATION FROM SCRIPT HEADER",
  "panels": [
    {
      "number": 1,
      "description": "Establishing shot or opening panel description. Include character positions, environment details, and mood. No dialogue for establishing panels.",
      "characters": ["Character Name 1", "Character Name 2"],
      "speech": [],
      "sourceSegmentIds": ["beat-0001"]
    },
    {
      "number": 2,
      "description": "Description of what's happening visually in this panel. Include character expressions, actions, and any important background elements. Maximum 5 characters visible.",
      "characters": ["Character Name 1", "Character Name 3"],
      "speech": [
        {
          "character": "Character Name",
          "line": "Exact dialogue from the script"
        }
      ],
      "sourceSegmentIds": ["beat-0002"]
    },
    {
      "number": 3,
      "description": "Continue breaking the scene into panels. Each panel should have a clear visual focus and advance the story. Only one character speaks per panel.",
      "characters": ["Character Name 2", "Character Name 3", "Character Name 4"],
      "speech": [
        {
          "character": "Character Name",
          "line": "Their line of dialogue"
        }
      ],
      "sourceSegmentIds": ["beat-0003", "beat-0004"]
    }
  ]
}
\`\`\`

## Panel Description Guidelines:

### For Panel Descriptions Include:
- Camera angle/shot type (wide, medium, close-up, etc.)
- Character positions and blocking (maximum 5 characters per panel)
- Facial expressions and body language
- Important props or environmental details
- Lighting or mood indicators
- Actions being performed

### Example Descriptions:
- "Wide shot: Peaches, Duco, and GeeBee stand in the shuttle bay, looking exhausted. Peaches is at the helm, whistling off-key."
- "Close on Duco's face, eyebrow raised skeptically as he processes the information."
- "Medium shot: Gulp excitedly gestures with both hands while Seamus and GeeBee exchange worried glances behind him."
- "High angle establishing shot of the village square at night, bonfire crackling at the center, villagers dancing."

## Speech Formatting:
- Each panel can contain only ONE character's dialogue
- If multiple characters need to speak in sequence, split across multiple panels
- Split long dialogue across multiple panels if needed for pacing, while keeping each spoken line exact
- Include tone indicators only when essential (e.g., "whispering", "shouting", "sarcastic")
- Sound effects can be noted in the description, not in speech array

## Character Limit Reminder:
- Each panel should list only the characters visible in that specific panel
- Maximum 5 characters per panel
- Focus on the most important characters for each panel's action
- Background characters can be mentioned in descriptions without being in the characters array
- If no named characters are visible, use \`"characters": []\`

## Source Segment Coverage:
- Each item in \`sourceSegments\` has an \`id\`, \`type\`, and exact source \`text\`.
- Add each relevant \`id\` to one or more panels using \`sourceSegmentIds\`.
- Long narration may be split into multiple source segment IDs; assign each part to the panel that represents it.
- Every source segment ID from \`sourceSegments\` must appear in at least one panel's \`sourceSegmentIds\`.

Convert the structured script JSON above into this scene JSON format, ensuring all dialogue is preserved exactly, all source segments are covered, all important scene beats are represented visually, and all character and panel limits are respected.`

const formatPromptExcerpt = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

const formatSourceSegmentChecklist = (structuredScript: StructuredScriptData): string => {
  return structuredScript.sourceSegments
    .map(segment => {
      const beat = segment.beatIndex ? `, beat ${segment.beatIndex}` : ''
      return `- ${segment.id} (${segment.type}${beat}): ${formatPromptExcerpt(segment.text)}`
    })
    .join('\n')
}

const formatStructuredScriptPrompt = (
  structuredScript: StructuredScriptData,
  recapMontageExpansions: RecapMontageExpansion[]
): string => {
  const recapMontageSection = formatRecapMontagePromptSection(recapMontageExpansions)

  return [
    '# Structured Script JSON',
    '',
    '```json',
    JSON.stringify(structuredScript, null, 2),
    '```',
    '',
    '---',
    '',
    JSON_PROMPT_TEMPLATE,
    '',
    '## Required Source Segment ID Checklist',
    'Before returning JSON, verify that every exact ID below appears in at least one panel `sourceSegmentIds` array.',
    '',
    formatSourceSegmentChecklist(structuredScript),
    ...(recapMontageSection ? ['', recapMontageSection] : []),
  ].join('\n')
}

export const generateJsonPrompt = async (
  sceneSlug: string
): Promise<{ filesProcessed: number; sourceSegments: number; recapMontages: number }> => {
  const stats = { filesProcessed: 0 }

  try {
    const structuredScriptPath = getStructuredScriptPath(sceneSlug)
    const structuredScript = await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
    const recapMontageExpansions = await resolveRecapMontageExpansions(structuredScript)

    const outputPath = getDraftPromptPath(sceneSlug)
    await mkdir(dirname(outputPath), { recursive: true })
    const combinedContent = formatStructuredScriptPrompt(structuredScript, recapMontageExpansions)

    await Bun.write(outputPath, combinedContent)
    stats.filesProcessed++
    comicLog.line('draft-prompt generated', [
      `file=${basename(outputPath)}`,
      `sourceSegments=${structuredScript.sourceSegments.length}`,
      recapMontageExpansions.length > 0 ? `recapMontages=${recapMontageExpansions.length}` : undefined,
    ])
    return {
      ...stats,
      sourceSegments: structuredScript.sourceSegments.length,
      recapMontages: recapMontageExpansions.length,
    }
  } catch (error) {
    err(
      `Failed to process ${sceneSlug}:`,
      error instanceof Error ? error.message : String(error)
    )
    throw error
  }
}
