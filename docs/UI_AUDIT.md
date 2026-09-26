# O Chat UI audit — 2026-09-23

For the later product-level visual critique and proposed style direction, see [PRODUCT_VISUAL_REVIEW.md](PRODUCT_VISUAL_REVIEW.md). This document records the earlier functional and responsive audit.

Scope: O Chat's own browser UI at desktop, 375px phone, and 320px narrow phone. I reviewed all 319 images from the full Chromium E2E run in contact sheets, opened representative states at full size, inspected the components behind each route, and reran the affected flows in a local browser. Agent-supplied Control Center HTML can vary by agent; this audit covers O Chat's frame, view switch, and built-in empty and error states.

| Surface | States checked | Browser coverage |
| --- | --- | --- |
| Agent picker and sidebar | No agents, saved agents, search, mobile drawer, long history, offline agents, removal | `add-agent`, `drawer`, `many-sessions`, `offline`, `remove-agent` |
| Agent landing | Online and offline identity, balance, suggested prompts, attachments, invite gate | `mobile`, `balance`, `onboard`, `attachments`, `reachability` |
| Conversation | Empty, streaming, tools, code, approvals, questions, voice, errors, reconnect, long transcript | `chat`, `empty-states`, `approval-decisions`, `blocking-prompts`, `voice`, `reconnect`, `scroll-follow` |
| Control Center and Work Room | Control/Chat switch, split view, resize, coding-agent status, permissions, stop, long activity | `dashboard`, `desktop-split`, `coding-agent-card`, `mode-controls` |
| Settings and links | Identity, recovery phrase, agent list and add form, malformed agent and session links | `settings`, `bad-address` |

## Findings fixed

| Priority | Reproduction | Change |
| --- | --- | --- |
| High | At 320 × 568, Settings → Reset showed a recovery phrase dialog taller than the screen. The only completion button was below the viewport, and the dialog could not scroll. | Bound the dialog to the viewport, make its content scroll, stack its actions on phones, and keep focus inside while it is open. |
| Medium | At 320px, Settings → Agents → Add agent placed the Add button outside the card and viewport. | Let the input shrink, remove the decorative icon on narrow screens, and use responsive padding. |
| Medium | A malformed agent or session link explained the format but gave no route back to saved agents. It also called arbitrary nonsense “incomplete.” | Add a clear return action and use accurate error copy. |
| Medium | Shared destructive confirmation dialogs left keyboard focus behind the overlay. | Focus Cancel, loop Tab between the two actions, and return focus to the trigger on dismissal. |

## Verification

The focused Chromium run covers each fixed state at 320px or 375px, including keyboard navigation. The production build, 197 unit tests, 210 Chromium scenarios, and 3 screenshot-flow checks pass locally. The complete browser screenshot set is available in the E2E run; recovery phrase screenshots are deliberately captured only after the phrase is dismissed.
