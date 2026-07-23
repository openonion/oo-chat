export const OOCHAT_DISABLED_OPTION_PREFIX = '__OOCHAT_DISABLED__::'

export function isAskUserOptionDisabled(option: string, disabledOptions: Set<string>): boolean {
  return disabledOptions.has(option) || option.startsWith(OOCHAT_DISABLED_OPTION_PREFIX)
}

export function askUserOptionLabel(option: string): string {
  return option.startsWith(OOCHAT_DISABLED_OPTION_PREFIX)
    ? option.slice(OOCHAT_DISABLED_OPTION_PREFIX.length)
    : option
}
