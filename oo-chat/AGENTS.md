# AGENTS.md

Welcome to the **oo-chat** codebase. This guide is for AI agents helping with development.

## Project Vision & Design Principles
- **Progressive Disclosure**: Keep simple things simple; make complicated things possible.
- **YAGNI**: Don't build features until they are explicitly needed.
- **Short & Sweet**: Functions should fit on a single screen and do one thing well.
- **Locality**: Keep helper functions near their features; avoid generic `utils.ts` or `helper.ts` files.
- **Indistinguishable Code**: Your code should match the quality and style of a senior engineer.

## Development Commands
```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint for code quality checks
npm start        # Run the production build
```
*Note: This project currently has no automated test suite. Manual verification is required.*

## Architecture
- **Framework**: Next.js 16 (App Router) with React 19.
- **Styling**: Tailwind CSS 4 (`globals.css` imports).
- **Icons**: `react-icons/hi` (Heroicons).
- **State**: `zustand` for global state (`@/store/chat-store`).
- **SDK**: `connectonion` for LLM abstraction and agent communication.
- **Components**: Reusable chat components in `components/chat/`.

## Code Style & Guidelines

### 1. Imports
- Use **absolute paths** with the `@/*` alias (maps to project root).
- Use `use client` at the top of files that utilize React hooks or browser APIs.
- Barrel exports (index.ts) are used for component modules.
- Sorting: React first, external libraries second, local imports third.

### 2. Naming Conventions
- **Components**: PascalCase (e.g., `ChatMessage.tsx`).
- **Hooks**: camelCase with `use` prefix (e.g., `useAgentSDK.ts`).
- **Variables/Functions**: camelCase (e.g., `handleSend`).
- **Interfaces/Types**: PascalCase (e.g., `Message`, `UI`).
- **Files**: kebab-case (e.g., `chat-input.tsx`).

### 3. Types
- Prefer **Interfaces** for object definitions and component props.
- Use **Types** for unions, aliases, or utility types.
- Maintain strict typing; avoid `any`. Use `Record<string, unknown>` for generic objects.
- Ensure props are properly typed in functional components.

### 4. React Patterns
- **Functional Components**: Use `export function ComponentName() { ... }` or `export default function ...`.
- **Hooks**: Leverage `useMemo` and `useCallback` for performance optimization in complex UI trees.
- **State**: Keep component state local where possible; use Zustand for cross-component state.

### 5. Error Handling
- **Avoid Try-Catch**: Unless explicitly required, let the program crash or throw errors to see the root cause. Do not use empty catch blocks.
- **API Routes**: Return consistent JSON error responses with appropriate HTTP status codes.
- **Validation**: Use TypeScript for compile-time safety and simple runtime checks.

### 6. Documentation
- Include **@purpose** and **@llm-note** headers in major files to help other agents understand the file's role, dependencies, and data flow.
- Keep comments concise and focused on the "why" rather than the "what".

## Related Projects
- **chat-ui**: Shared component source. If modifying `components/chat/`, verify if synchronization is needed with `../chat-ui/registry/`.

## External Resources
- **Docs**: [https://docs.connectonion.com](https://docs.connectonion.com)
- **Discord**: [https://discord.gg/4xfD9k8AUF](https://discord.gg/4xfD9k8AUF)
- **OpenOnion API**: oo.openonion.ai
- **Frontend**: o.openonion.ai
