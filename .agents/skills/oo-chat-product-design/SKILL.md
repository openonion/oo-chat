---
name: oo-chat-product-design
description: Design and critique O Chat's agent discovery, conversation, approval, and settings UI using its specific workbench style and OpenOnion identity.
---

# O Chat product design

Use for O Chat's application surfaces. Read `docs/DESIGN_SYSTEM.md` in the active `oo-chat` repository before making design decisions; it is the maintained source for visual tokens, screen signatures, interaction states, and review criteria. For the current visual migration, also read `docs/PRODUCT_VISUAL_REVIEW.md`, which records screenshot evidence and proposals that still need validation. If this skill is loaded from a local installed copy, locate the active `oo-chat` repository and read that file there. Follow the user's current direction when it intentionally revises the standard.

## Style in one view

O Chat is a composed Agent workbench. A lightly tinted shell and fine dividers hold a white working surface. Near-black gives structure and a clear primary action; the actual onion mark contributes soft lavender identity; dark violet marks selection and focus. Green means available or successful, amber means attention, and red means failure or destructive consequence. Conversation, work state, and the next decision have more visual weight than decoration.

The canonical asset is `public/onion.png`: black contour, white rings, lavender fills, transparent background. Keep its colour and proportions. Use it as a restrained product signature where the contour remains visible, not as a repeated card icon. A public OpenOnion landing page may share this mark and palette but has a different narrative layout and type scale.

## Design each state around substance

For Explore and agent profiles, show what an agent actually does, what the user supplies, the expected result, availability, and access. Do not imply that a discovered or online agent is automatically trusted or open to everyone. For conversation, keep agent context, transcript, current work, and composer legible. For approval, show requested action, scope, and consequence before the choices. For settings, show current values and recovery consequences clearly.

Establish hierarchy with real content before adjusting colour or icons. Keep the app's sans/mono typography practical; reserve serif for a deliberate introduction. Use spacing to express relationship, avoid card nesting, and use motion only to explain a state change. Treat loading, empty, partial, offline, disabled, error, and long-content states as designed states.

## Deliver and verify

Work in a representative screen slice and apply a proven pattern to adjacent surfaces. Compare the same state at 390, 768, and 1280 px, plus keyboard focus and the material edge case. Use the `frontend-ui-verify` skill when browser verification is needed. Include before/after visual evidence, specific hierarchy and token decisions, and remaining migration gaps. Keep the design standard current when an approved decision changes it.
