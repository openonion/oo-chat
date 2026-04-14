# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oo-chat is an open-source chat client for AI agents built with Next.js 16. It supports two connection modes:
- **Remote Agent**: Connect to deployed ConnectOnion agents via URL
- **Direct LLM**: Use LLM APIs directly with managed (co/) or provider API keys

Part of the ConnectOnion platform ecosystem.

## Development Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint check
npm start        # Run production build
```

## Architecture

```
app/
├── page.tsx           # Main chat UI with conversation management and settings
├── layout.tsx         # Root layout with Inter font
├── globals.css        # Tailwind CSS styles
└── api/chat/route.ts  # API route handling both agent and LLM connections

components/chat/       # Reusable chat component library
├── chat.tsx           # Main Chat component
├── chat-input.tsx     # Message input with keyboard shortcuts
├── chat-message.tsx   # Individual message display
├── chat-messages.tsx  # Message list container
├── chat-empty-state.tsx # Welcome screen with suggestions
├── chat-typing.tsx    # Loading indicator
├── use-chat.ts        # Chat state management hook
├── types.ts           # TypeScript interfaces
└── index.ts           # Barrel exports
```

### Key Patterns

**Connection Modes** (`app/page.tsx`):
- Agent mode: POST to `{agentUrl}/input` with `{ prompt: message }`
- LLM mode: Uses `connectonion` SDK's `createLLM()` for chat completions

**Chat Hook** (`components/chat/use-chat.ts`):
- Manages messages state and loading
- `onSend` callback handles actual API communication
- Returns `{ messages, isLoading, send, setMessages, clear }`

**Path Alias**: `@/*` maps to project root

## Environment Variables

```bash
NEXT_PUBLIC_DEFAULT_AGENT_URL  # Pre-configured agent URL (optional)
OPENAI_API_KEY                  # For direct LLM mode
ANTHROPIC_API_KEY               # For direct LLM mode
GEMINI_API_KEY                  # For direct LLM mode
```

## Dependencies

- `connectonion`: Local TypeScript SDK (`file:../connectonion-ts`) for LLM abstraction
- `react-icons`: UI icons (HiOutline* from Heroicons)
- `clsx` + `tailwind-merge`: Conditional class utilities

## Related Projects

- `../chat-ui` (`@connectonion/chat-ui`): Source component library for the chat components. When fixing design issues in `components/chat/`, also update the corresponding files in `../chat-ui/registry/` to keep them in sync.
