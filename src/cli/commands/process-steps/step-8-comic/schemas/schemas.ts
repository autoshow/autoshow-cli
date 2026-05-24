import * as v from 'valibot'
import type {
  CharacterFilePath,
} from '../types'


export const CHARACTER_FILES = {
  '00': 'input/uss/characters/00-uss-acampo.webp',
  '01': 'input/uss/characters/01-peaches.webp',
  '02': 'input/uss/characters/02-bishop.webp',
  '03': 'input/uss/characters/03-duco.webp',
  '04': 'input/uss/characters/04-geebee.webp',
  '05': 'input/uss/characters/05-seamus.webp',
  '06': 'input/uss/characters/06-gulp.webp',
  '07': 'input/uss/characters/07-paddy.webp',
  '08': 'input/uss/characters/08-specter.webp',
  '09': 'input/uss/characters/09-ironhand-1.webp',
  '10': 'input/uss/characters/10-ironhand-2.webp',
  '11': 'input/uss/characters/11-ironhand-3.webp',
  '12': 'input/uss/characters/12-chat.webp',
  '13': 'input/uss/characters/13-podcast-host.webp',
  '14': 'input/uss/characters/14-buoy-4-buoy-6.webp',
  '15': 'input/uss/characters/15-villagers.webp',
  '16': 'input/uss/characters/16-village-guards.webp',
} as const


const CHARACTER_FILE_PATHS = Object.values(CHARACTER_FILES) as [CharacterFilePath, ...CharacterFilePath[]]
const CHARACTER_REFERENCE_IMAGE_PATH_PATTERN = /^input\/uss\/characters\/.+\.(?:png|webp|jpg|jpeg)$/
const CHARACTER_SKETCH_IMAGE_PATH_PATTERN = /^output\/characters\/sketches\/.+\.png$/

export const CHARACTER_NAMES = [
  'Peaches', 'Bishop', 'Duco', 'GeeBee', 'Seamus', 'Gulp', 'Paddy', 'Specter',
  'Ironhand #1', 'Ironhand #2', 'Ironhand #3', 'HR Hologram', 'Podcast Host',
  'Buoy 4 & Buoy 6', 'Wilhelm Speaking Villagers', 'Guards'
] as const

export const CHARACTER_REFERENCE_ALIASES = {
  CHAT: 'HR Hologram',
} as const

export const STRUCTURED_SCRIPT_BEAT_TYPES = ['narration', 'dialogue', 'direction', 'transition', 'panel-note'] as const

export const CharacterReferenceImagePathSchema = v.pipe(
  v.string(),
  v.regex(CHARACTER_REFERENCE_IMAGE_PATH_PATTERN, 'Expected a character reference image path under input/uss/characters/')
)

export const CharacterSketchImagePathSchema = v.pipe(
  v.string(),
  v.regex(CHARACTER_SKETCH_IMAGE_PATH_PATTERN, 'Expected a character sketch image path under output/characters/sketches/')
)

const AuthoredCharacterDetailsSchema = v.object({
  name: v.string(),
  image: v.picklist(CHARACTER_FILE_PATHS),
  description: v.string()
})

const ExpandedCharacterDetailsSchema = v.object({
  name: v.string(),
  image: CharacterReferenceImagePathSchema,
  description: v.string(),
  sketchImages: v.optional(v.array(CharacterSketchImagePathSchema)),
})

const ScenePromptsSchema = v.object({
  Prefix: v.optional(v.string()),
  '1st Panel': v.string(),
  '2nd Panel': v.optional(v.string()),
  '3rd Panel': v.optional(v.string())
})

const SketchPromptsSchema = v.object({
  Prefix: v.optional(v.string()),
  Chunk: v.string(),
})

const CharacterSketchPromptsSchema = v.object({
  Prefix: v.optional(v.string()),
  Character: v.string(),
  Front: v.string(),
  'Three-Quarter': v.string(),
  Profile: v.string(),
})

const ImagePromptVariationsSchema = v.object({
  'animation-polish': v.string(),
  'cinematic-depth': v.string(),
})

const EpisodeEntrySchema = v.object({
  scenes: v.array(v.string()),
  scripts: v.array(v.string())
})

const SpeechItemSchema = v.object({
  character: v.string(),
  line: v.string(),
  tone: v.optional(v.string())
})

const StructuredScriptMetadataEntrySchema = v.object({
  label: v.string(),
  value: v.optional(v.string()),
  raw: v.string()
})

const StructuredScriptMentionSchema = v.object({
  raw: v.string(),
  characters: v.array(v.picklist(CHARACTER_NAMES))
})

const StructuredScriptLocationSchema = v.object({
  raw: v.string(),
  type: v.optional(v.string()),
  place: v.optional(v.string())
})

const StructuredScriptBeatSchema = v.object({
  index: v.number(),
  type: v.picklist(STRUCTURED_SCRIPT_BEAT_TYPES),
  text: v.string(),
  characters: v.array(v.picklist(CHARACTER_NAMES)),
  rawMentions: v.array(StructuredScriptMentionSchema),
  speaker: v.optional(v.picklist(CHARACTER_NAMES)),
  speakerLabel: v.optional(v.string()),
  delivery: v.optional(v.string())
})

const StructuredScriptSourceSegmentSchema = v.object({
  id: v.string(),
  type: v.picklist(STRUCTURED_SCRIPT_BEAT_TYPES),
  text: v.string(),
  rawMarkdown: v.optional(v.string()),
  beatIndex: v.optional(v.number()),
  speaker: v.optional(v.picklist(CHARACTER_NAMES)),
  speakerLabel: v.optional(v.string()),
  delivery: v.optional(v.string())
})

const PanelSchema = v.object({
  number: v.number(),
  description: v.string(),
  characters: v.array(v.string()),
  speech: v.array(SpeechItemSchema),
  sourceSegmentIds: v.array(v.string())
})

export const CharacterReferenceSchema = v.object({
  charactersReference: v.record(v.picklist(CHARACTER_NAMES), AuthoredCharacterDetailsSchema)
})

export const PromptsConfigSchema = v.object({
  'Scene Prompts': ScenePromptsSchema,
  'Sketch Prompts': SketchPromptsSchema,
  'Character Sketch Prompts': CharacterSketchPromptsSchema,
  'Image Prompt Variations': ImagePromptVariationsSchema,
})


export const EpisodeManifestSchema = v.object({
  episodes: v.record(v.string(), EpisodeEntrySchema)
})


export const StructuredScriptDataSchema = v.object({
  scriptSlug: v.string(),
  sourceFile: v.string(),
  document: v.object({
    heading: v.string(),
    label: v.optional(v.string()),
    title: v.string(),
    metadata: v.array(StructuredScriptMetadataEntrySchema)
  }),
  scene: v.object({
    heading: v.string(),
    section: v.optional(v.string()),
    title: v.string(),
    location: StructuredScriptLocationSchema
  }),
  characters: v.array(v.picklist(CHARACTER_NAMES)),
  beats: v.array(StructuredScriptBeatSchema),
  sourceSegments: v.array(StructuredScriptSourceSegmentSchema)
})


export const STRUCTURED_SCRIPT_JSON_SCHEMA = {
  name: 'structured_script_data',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      scriptSlug: { type: 'string' as const },
      sourceFile: { type: 'string' as const },
      document: {
        type: 'object' as const,
        properties: {
          heading: { type: 'string' as const },
          label: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
          title: { type: 'string' as const },
          metadata: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                label: { type: 'string' as const },
                value: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                raw: { type: 'string' as const },
              },
              required: ['label', 'value', 'raw'] as const,
              additionalProperties: false,
            },
          },
        },
        required: ['heading', 'label', 'title', 'metadata'] as const,
        additionalProperties: false,
      },
      scene: {
        type: 'object' as const,
        properties: {
          heading: { type: 'string' as const },
          section: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
          title: { type: 'string' as const },
          location: {
            type: 'object' as const,
            properties: {
              raw: { type: 'string' as const },
              type: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
              place: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
            },
            required: ['raw', 'type', 'place'] as const,
            additionalProperties: false,
          },
        },
        required: ['heading', 'section', 'title', 'location'] as const,
        additionalProperties: false,
      },
      characters: {
        type: 'array' as const,
        items: { type: 'string' as const, enum: CHARACTER_NAMES },
      },
      beats: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            index: { type: 'integer' as const },
            type: { type: 'string' as const, enum: [...STRUCTURED_SCRIPT_BEAT_TYPES] },
            text: { type: 'string' as const },
            characters: {
              type: 'array' as const,
              items: { type: 'string' as const, enum: CHARACTER_NAMES },
            },
            rawMentions: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  raw: { type: 'string' as const },
                  characters: {
                    type: 'array' as const,
                    items: { type: 'string' as const, enum: CHARACTER_NAMES },
                  },
                },
                required: ['raw', 'characters'] as const,
                additionalProperties: false,
              },
            },
            speaker: { anyOf: [{ type: 'string' as const, enum: CHARACTER_NAMES }, { type: 'null' as const }] },
            speakerLabel: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
            delivery: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
          },
          required: ['index', 'type', 'text', 'characters', 'rawMentions', 'speaker', 'speakerLabel', 'delivery'] as const,
          additionalProperties: false,
        },
      },
      sourceSegments: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            type: { type: 'string' as const, enum: [...STRUCTURED_SCRIPT_BEAT_TYPES] },
            text: { type: 'string' as const },
            rawMarkdown: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
            beatIndex: { anyOf: [{ type: 'integer' as const }, { type: 'null' as const }] },
            speaker: { anyOf: [{ type: 'string' as const, enum: CHARACTER_NAMES }, { type: 'null' as const }] },
            speakerLabel: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
            delivery: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
          },
          required: ['id', 'type', 'text', 'rawMarkdown', 'beatIndex', 'speaker', 'speakerLabel', 'delivery'] as const,
          additionalProperties: false,
        },
      },
    },
    required: ['scriptSlug', 'sourceFile', 'document', 'scene', 'characters', 'beats', 'sourceSegments'] as const,
    additionalProperties: false,
  },
}

export const ScenePromptDataSchema = v.object({
  title: v.string(),
  location: v.string(),
  panels: v.array(PanelSchema)
})

export const SCENE_JSON_SCHEMA = {
  name: 'scene_prompt_data',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' as const },
      location: { type: 'string' as const },
      panels: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            number: { type: 'integer' as const },
            description: { type: 'string' as const },
            characters: { type: 'array' as const, items: { type: 'string' as const } },
            sourceSegmentIds: { type: 'array' as const, items: { type: 'string' as const } },
            speech: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  character: { type: 'string' as const },
                  line: { type: 'string' as const },
                  tone: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] }
                },
                required: ['character', 'line', 'tone'] as const,
                additionalProperties: false
              }
            }
          },
          required: ['number', 'description', 'characters', 'speech', 'sourceSegmentIds'] as const,
          additionalProperties: false
        }
      }
    },
    required: ['title', 'location', 'panels'] as const,
    additionalProperties: false
  }
}

export const ExpandedScenePromptDataSchema = v.object({
  title: v.string(),
  location: v.string(),
  panels: v.array(v.object({
    number: v.number(),
    description: v.string(),
    characters: v.array(ExpandedCharacterDetailsSchema),
    speech: v.array(SpeechItemSchema),
    sourceSegmentIds: v.array(v.string()),
    sourceSegments: v.array(StructuredScriptSourceSegmentSchema)
  }))
})
