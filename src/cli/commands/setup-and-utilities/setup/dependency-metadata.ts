import { join } from 'node:path'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { validateJson } from '~/utils/validate/validation'

const DependencyEntrySchema = v.object({
  tag: v.optional(v.string(), undefined),
  version: v.optional(v.string(), undefined),
  ref: v.optional(v.string(), undefined)
})

const DependencyMetadataSchema = v.record(v.string(), DependencyEntrySchema)

export type DependencyMetadata = v.InferOutput<typeof DependencyMetadataSchema>

export const depsJsonPath = join(PROJECT_ROOT, 'config/deps.json')

export const DEFAULT_DEPENDENCY_METADATA: DependencyMetadata = {
  'whisper.cpp': { tag: 'v1.7.4' },
  'llama.cpp': { tag: 'b8087' },
  uv: { version: '0.11.14' },
  reverb: { ref: '8cd4099828d68e464a9536ccb6a380ddad07c982' }
}

export const readDependencyMetadata = async (): Promise<DependencyMetadata> => {
  try {
    const raw = await Bun.file(depsJsonPath).text()
    return {
      ...DEFAULT_DEPENDENCY_METADATA,
      ...validateJson(DependencyMetadataSchema, raw, 'config/deps.json')
    }
  } catch {
    return DEFAULT_DEPENDENCY_METADATA
  }
}

export const readDependencyTag = async (name: string): Promise<string | undefined> => {
  const metadata = await readDependencyMetadata()
  return metadata[name]?.tag
}

export const readDependencyVersion = async (name: string): Promise<string | undefined> => {
  const metadata = await readDependencyMetadata()
  return metadata[name]?.version
}

export const readDependencyRef = async (name: string): Promise<string | undefined> => {
  const metadata = await readDependencyMetadata()
  return metadata[name]?.ref
}
