import { describe, expect, it } from 'vitest'
import { usageStats } from './usage-stats'

describe('usageStats', () => {
  it('shows cached input as a subset and derives new input', () => {
    expect(usageStats({
      input_tokens: 10_509,
      output_tokens: 4,
      total_tokens: 10_513,
      cached_tokens: 8_167,
      cost: 0.002385,
    } as never)).toEqual({
      hasBreakdown: true,
      inputTokens: 10_509,
      cachedTokens: 8_167,
      uncachedInputTokens: 2_342,
      cacheWriteTokens: 0,
      outputTokens: 4,
      totalTokens: 10_513,
      cost: 0.002385,
    })
  })

  it('accepts the raw proxy contract and its final cost', () => {
    const stats = usageStats({
      prompt_tokens: 100,
      completion_tokens: 5,
      prompt_tokens_details: { cached_tokens: 80 },
      uncached_prompt_tokens: 20,
      cost_usd: 0.0002,
    } as never)

    expect(stats.cachedTokens).toBe(80)
    expect(stats.uncachedInputTokens).toBe(20)
    expect(stats.cost).toBe(0.0002)
  })

  it('prefers the normalized managed contract and preserves cache writes', () => {
    expect(usageStats({
      input_tokens: 1,
      output_tokens: 50,
      input_tokens_total: 600,
      input_tokens_uncached: 100,
      cache_read_input_tokens: 200,
      cache_write_input_tokens: 300,
      total_tokens: 650,
      cost: 0.002685,
    } as never)).toEqual({
      hasBreakdown: true,
      inputTokens: 600,
      cachedTokens: 200,
      uncachedInputTokens: 100,
      cacheWriteTokens: 300,
      outputTokens: 50,
      totalTokens: 650,
      cost: 0.002685,
    })
  })

  it('keeps a legacy total-only usage honest', () => {
    expect(usageStats({ total_tokens: 42 } as never)).toEqual({
      hasBreakdown: false,
      inputTokens: 0,
      cachedTokens: 0,
      uncachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      totalTokens: 42,
      cost: 0,
    })
  })
})
