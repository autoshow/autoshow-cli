import * as v from 'valibot'
import { ModelRegistrySchema } from '~/cli/commands/models/model-loader'

export type ModelRegistry = v.InferOutput<typeof ModelRegistrySchema>
