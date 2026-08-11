export const DISABLED_OPTION_PREFIX = '__OOCHAT_DISABLED__::'

export interface AskUserOption {
  value: string
  label: string
  disabled: boolean
}

export function normalizeAskUserOptions(
  options: string[] | undefined,
  disabledOptions: string[] | undefined = undefined,
): AskUserOption[] {
  const disabledValues = new Set(disabledOptions || [])
  return (options || []).map(value => {
    const prefixed = value.startsWith(DISABLED_OPTION_PREFIX)
    return {
      value,
      label: prefixed ? value.slice(DISABLED_OPTION_PREFIX.length) : value,
      disabled: prefixed || disabledValues.has(value),
    }
  })
}
