import type { ThinkingUI } from '../types'

type Usage = NonNullable<ThinkingUI['usage']> & {
  cached_tokens?: number
  uncached_input_tokens?: number
  uncached_prompt_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  input_tokens_details?: { cached_tokens?: number }
  cost_usd?: number
}

export interface UsageStats {
  inputTokens: number
  cachedTokens: number
  uncachedInputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
}

export function usageStats(usage?: ThinkingUI['usage']): UsageStats {
  const value = (usage || {}) as Usage
  const inputTokens = value.input_tokens ?? value.prompt_tokens ?? 0
  const rawCached = value.cached_tokens
    ?? value.prompt_tokens_details?.cached_tokens
    ?? value.input_tokens_details?.cached_tokens
    ?? 0
  const cachedTokens = Math.min(inputTokens, Math.max(0, rawCached))
  const uncachedInputTokens = value.uncached_input_tokens
    ?? value.uncached_prompt_tokens
    ?? Math.max(0, inputTokens - cachedTokens)
  const outputTokens = value.output_tokens ?? value.completion_tokens ?? 0

  return {
    inputTokens,
    cachedTokens,
    uncachedInputTokens,
    outputTokens,
    totalTokens: value.total_tokens || inputTokens + outputTokens,
    cost: value.cost ?? value.cost_usd ?? 0,
  }
}
