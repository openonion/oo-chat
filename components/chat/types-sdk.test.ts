import { expectTypeOf, test } from 'vitest'
import type { ChatItem } from '@connectonion/react'
import type { CollaborationMode, PermissionProfile, UI, UIType } from './types'

test('the component boundary is the SDK presentation contract', () => {
  expectTypeOf<UI>().toEqualTypeOf<ChatItem>()
  expectTypeOf<UIType>().toEqualTypeOf<ChatItem['type']>()
  expectTypeOf<CollaborationMode>().toEqualTypeOf<'default' | 'plan'>()
  expectTypeOf<PermissionProfile>().toEqualTypeOf<
    ':read-only' | ':workspace' | ':danger-full-access'
  >()
})
