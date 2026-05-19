import { CLIUsageError } from '~/utils/error-handler'

export const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const createModelValidator = <T extends string>(
  supported: readonly T[],
  flag: string,
  extraMessage?: string
) =>
  (model: string): T => {
    if (!supported.includes(model as T)) {
      const suffix = extraMessage ? ` ${extraMessage}` : ''
      throw CLIUsageError(
        `Invalid --${flag} model "${model}".${suffix} Allowed values: ${formatAllowedValues(supported)}`
      )
    }
    return model as T
  }

export const buildModelDescription = (label: string, models: readonly string[]): string =>
  `${label} (omit value for cheapest supported model): ${models.join('|')}`
