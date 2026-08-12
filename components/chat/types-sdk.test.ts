import { expectTypeOf, test } from 'vitest'
import type { ChatItem } from '@connectonion/react'
import type { ApprovalMode, UI, UIType } from './types'

test('the component boundary is the SDK presentation contract', () => {
  expectTypeOf<UI>().toEqualTypeOf<ChatItem>()
  expectTypeOf<UIType>().toEqualTypeOf<ChatItem['type']>()
  expectTypeOf<ApprovalMode>().toEqualTypeOf<
    'default' | 'plan' | 'auto_approve' | 'full_access'
  >()
})
