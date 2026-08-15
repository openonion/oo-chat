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
      inputTokens: 10_509,
      cachedTokens: 8_167,
      uncachedInputTokens: 2_342,
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
})
