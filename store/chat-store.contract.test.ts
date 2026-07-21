import type { Conversation } from './chat-store'

type ConversationStillOwnsTranscript = 'ui' extends keyof Conversation ? true : false

const transcriptLivesInSdkSessionStore: false =
  null as unknown as ConversationStillOwnsTranscript

void transcriptLivesInSdkSessionStore
