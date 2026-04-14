# GEMINI.md

This file provides context and guidance for the Gemini CLI agent when working with the `oo-chat` repository.

## Project Overview

**oo-chat** is an open-source chat interface for AI agents, built as part of the **ConnectOnion** platform ecosystem. It is a **Next.js 16** application that serves as a frontend for interacting with AI agents or direct LLMs.

**Key Features:**
*   **Dual Connection Modes:**
    *   **Remote Agent Mode:** Connects to deployed ConnectOnion agents via URL, using Ed25519 signed requests for authentication.
    *   **Direct LLM Mode:** Connects directly to LLM providers (OpenAI, Anthropic, Gemini) using the `connectonion` SDK.
*   **Modern Stack:** React 19, TypeScript, Tailwind CSS, Zustand.
*   **Streaming:** Supports real-time streaming of responses and tool executions via WebSockets (in Agent mode) or HTTP streaming.

## Building and Running

### Prerequisites
*   Node.js (v20+ recommended)
*   `npm` or `yarn`/`pnpm`

### Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server at `http://localhost:3000`. |
| `npm run build` | Builds the application for production. |
| `npm start` | Runs the production build. |
| `npm run lint` | Runs ESLint to check for code quality issues. |

## Testing

Testing in this project relies heavily on **browser automation** and **visual regression** using the ConnectOnion CLI tool (`co`).

**Primary Test Command:**
```bash
# Clear proxy settings to avoid localhost issues
http_proxy="" https_proxy="" all_proxy="" co -b "screenshot localhost:3000"
```

**Common Test Scenarios:**
*   **Screenshot:** `co -b "screenshot localhost:3000"` (Saves to `.tmp/`)
*   **Interaction:** `co -b "go to localhost:3000 and send message 'hello'"`

**Note:** Ensure the dev server (`npm run dev`) and any required backend agents (`oo`) are running before executing tests.

## Architecture

### Directory Structure

*   `app/`: Next.js App Router.
    *   `page.tsx`: Main chat UI entry point.
    *   `api/chat/route.ts`: Backend API route handling Agent/LLM requests.
*   `components/chat/`: Reusable chat UI components.
    *   `use-chat.ts`: Core React hook for chat state management.
    *   `chat.tsx`: Main Chat component.
*   `store/`: State management (Zustand).

### Connection Modes

1.  **Agent Mode (Stateful):**
    *   **Client:** Sends request to `/api/chat` with `agentUrl`.
    *   **Server (`api/chat/route.ts`):** Signs the request using Ed25519 keys (loaded/generated in `.co/`) and forwards it to the Agent's `/input` endpoint.
    *   **Protocol:** Supports multi-turn conversations via `session` objects.

2.  **LLM Mode (Stateless):**
    *   **Client:** Sends request to `/api/chat` with `apiKey` and `model`.
    *   **Server:** Uses `connectonion` SDK's `createLLM` to call the provider API directly.

## Development Conventions

*   **Style:** Tailwind CSS for styling. Use `clsx` and `tailwind-merge` for dynamic classes.
*   **Type Safety:** Strict TypeScript usage. Interfaces defined in `types.ts` files.
*   **Local Dependencies:** The project relies on `connectonion-ts` (aliased as `connectonion` in `package.json`).
*   **Environment Variables:**
    *   `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`: For Direct LLM mode.
    *   `NEXT_PUBLIC_DEFAULT_AGENT_URL`: Optional default agent URL.
*   **Proxy Handling:** When running locally with tools like `co` or connecting to local agents, ensure `http_proxy` variables are cleared to prevent routing conflicts.
