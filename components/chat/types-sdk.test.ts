import { expectTypeOf, test } from 'vitest'
import type { ChatItem, Mode } from '@connectonion/react'
import type { UI, UIType } from './types'

test('the component boundary is the SDK presentation contract', () => {
  expectTypeOf<UI>().toEqualTypeOf<ChatItem>()
  expectTypeOf<UIType>().toEqualTypeOf<ChatItem['type']>()
  expectTypeOf<Mode>().toEqualTypeOf<'read-only' | 'auto' | 'full-access'>()
})
