import * as v from 'valibot'
import { ModelRegistrySchema } from '~/cli/commands/setup-and-utilities/models/model-loader'

export type ModelRegistry = v.InferOutput<typeof ModelRegistrySchema>
