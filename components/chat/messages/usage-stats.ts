import type { ThinkingUI } from '../types'

type Usage = NonNullable<ThinkingUI['usage']> & {
  input_tokens_total?: number
  input_tokens_uncached?: number
  cache_read_input_tokens?: number
  cache_write_input_tokens?: number
  cached_tokens?: number
  uncached_input_tokens?: number
  uncached_prompt_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  input_tokens_details?: { cached_tokens?: number }
  cost_usd?: number
  normalized?: {
    input_tokens_total?: number
    input_tokens_uncached?: number
    cache_read_input_tokens?: number
    cache_write_input_tokens?: number
    output_tokens?: number
  }
}

export interface UsageStats {
  hasBreakdown: boolean
  inputTokens: number
  cachedTokens: number
  uncachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
}

export function usageStats(usage?: ThinkingUI['usage']): UsageStats {
  const value = (usage || {}) as Usage
  const hasBreakdown = [
    value.input_tokens_total,
    value.normalized?.input_tokens_total,
    value.input_tokens,
    value.prompt_tokens,
    value.normalized?.output_tokens,
    value.output_tokens,
    value.completion_tokens,
  ].some(item => typeof item === 'number')
  const inputTokens = value.input_tokens_total
    ?? value.normalized?.input_tokens_total
    ?? value.input_tokens
    ?? value.prompt_tokens
    ?? 0
  const rawCached = value.cache_read_input_tokens
    ?? value.normalized?.cache_read_input_tokens
    ?? value.cached_tokens
    ?? value.prompt_tokens_details?.cached_tokens
    ?? value.input_tokens_details?.cached_tokens
    ?? 0
  const cachedTokens = Math.min(inputTokens, Math.max(0, rawCached))
  const uncachedInputTokens = value.input_tokens_uncached
    ?? value.normalized?.input_tokens_uncached
    ?? value.uncached_input_tokens
    ?? value.uncached_prompt_tokens
    ?? Math.max(0, inputTokens - cachedTokens)
  const cacheWriteTokens = value.cache_write_input_tokens
    ?? value.normalized?.cache_write_input_tokens
    ?? 0
  const outputTokens = value.normalized?.output_tokens
    ?? value.output_tokens
    ?? value.completion_tokens
    ?? 0

  return {
    hasBreakdown,
    inputTokens,
    cachedTokens,
    uncachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    totalTokens: value.total_tokens || inputTokens + outputTokens,
    cost: value.cost ?? value.cost_usd ?? 0,
  }
}
