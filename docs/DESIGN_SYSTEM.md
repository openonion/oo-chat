# O Chat product design standard

**Status:** target standard for new UI and incremental refinement. The existing interface has not yet been fully migrated. Review visual changes against this document and the actual task flow, not against a generic landing-page template.

## Product promise

O Chat is a place to find an agent, understand what it can do, give it a task, and supervise the work. A good screen makes four things legible: **who/what this is**, **what the user can do next**, **what is happening now**, and **what needs the user's decision**. Show real capabilities, required inputs, expected outputs, access boundaries, and run state before decorative brand copy. Do not manufacture activity or imply that discovery means trust or permission.

## Visual direction

A quiet, precise workbench with a recognisable OpenOnion identity. Neutral surfaces carry conversations and tools; restrained onion violet marks brand, selection, and focus; green reports availability or success; amber reports pending decisions; red reports failure or destructive action. Reserve saturated colour for meaning. The keyline, typography, and layout should carry structure before colour or shadow does.

| Role | Target token | Use |
| --- | --- | --- |
| Canvas | `#F7F7F9` | App surround and secondary panes |
| Surface | `#FFFFFF` | Conversation, panels, menus |
| Text | `#1C1922` | Primary content |
| Muted text | `#57535F` | Secondary content that must remain readable |
| Border | `#E5E2E9` | Boundaries where grouping needs them |
| Identity / selected | `#624593` | Active navigation, identity details, focus |
| Identity tint | `#F2EDF8` | Selected background and restrained highlights |
| Success / online | `#137342` | Positive system status only |
| Attention | `#8A5B08` | Pending approval or intervention |
| Danger | `#B42318` | Failure, rejection, destructive actions |

These are design targets, not a claim that existing `brand-*` utilities already mean identity. Today `app/globals.css` defines `brand-*` as green and uses it for both status and interaction. Migration should introduce semantic tokens and replace usages by meaning, component by component. Never recolour all `brand-*` references globally: online, success, focus, and code-diff additions currently share that class for different reasons.

## Typography and iconography

- Use a restrained sans family for the workbench. Keep serif for a deliberate editorial moment, such as first-use or discovery introduction; do not use it for task controls, status, or settings. Use mono for addresses, commands, paths, and code only.
- Establish hierarchy by role and available width: display 32–40 px, page 24–28 px, section 18–20 px, working text 14–16 px, metadata 12–13 px. These are starting ranges, not one size for every heading. On dense screens, hierarchy should survive without giant headlines.
- Use one outline icon family at consistent optical sizes (typically 16, 20, 24 px). Give ambiguous icons text labels or accessible names. Icons help scan a known action or state; they do not replace clear words. Do not decorate every card with an icon.
- Write action labels as verbs and state labels as facts. Distinguish “online”, “available to chat”, “published”, and “permission granted”.

## Layout and density

- First viewport: show the primary task and a meaningful next step. On Explore, a real agent's task, input, output, and availability outrank a hero. In chat, conversation and composer outrank decorative introduction. In settings, current values and consequences outrank introductory prose.
- Use a list/detail layout when users compare agents or sessions; use a focused reading column for conversation. Sidebars are navigation, not collections of competing cards. Keep the composer anchored and protect room for the transcript.
- Spacing scale: 4, 8, 12, 16, 24, 32 px. Choose spacing to express relationships: tighter within a control or item, wider between distinct sections. No universal section padding or fixed percentage of empty space.
- Draw a border when it clarifies a surface, decision, or grouping. Avoid nesting bordered cards inside bordered cards. Use elevation for overlays; avoid floating every ordinary item.
- Radius and shadow should be consistent by component role: compact controls, panels, overlays. Do not change radius just to make a screen feel “designed”.
- At desktop, tablet, and phone widths, preserve the same task order while changing composition. A phone should expose the next action without horizontal scrolling or tiny targets.

## Interaction states

Every interactive component needs its applicable states: default, hover where relevant, keyboard focus, pressed, loading, disabled with a reason, success, and error. Every data surface needs honest loading, empty, offline, and partial-data treatments. An approval must make the requested action, scope, and consequence visible before its buttons. Motion should communicate a state change; avoid staggered entrance on the main task path. Respect reduced motion.

Use WCAG 2.2 AA as the accessibility floor: 4.5:1 contrast for normal text, 3:1 for large text and meaningful non-text UI, visible keyboard focus, and target spacing/size that meets the applicable criterion. Prefer comfortably sized touch controls on phones. Test with actual content length, not only ideal fixtures.

## Design review before merge

1. Name the user's task, next action, and the state each screen must communicate. Capture a baseline at 390 px, 768 px, and 1280 px, including a real long-content case.
2. Sketch the information hierarchy before changing colours or icons. Ask whether task, input/output, status, and decision are visible at the right moment.
3. Reuse existing components/tokens; add a semantic token or component only when a recurring role warrants it. Check alignment, type rhythm, content density, and labels across adjacent screens.
4. Inspect interaction states and keyboard flow; measure overflow and contrast. Capture after screenshots at the same widths and state as the baseline.
5. Report what improved, what remains inconsistent, and the evidence. Do not assign a fabricated numerical “design score”.

## Current migration priorities

1. Separate green operational status from violet identity/selection/focus tokens.
2. Replace the first-use page's oversized editorial hierarchy and blank space with a useful Explore preview and clear direct-connect path.
3. Simplify nested cards and borders in settings, sidebar, and agent profiles; establish one layout/density pattern for each surface type.
4. Make chat and approval states more distinct through typography and semantic status, including meaningful empty and offline states.
5. Audit icon sizes, labels, motion, and responsive states after the structural changes.

## References

- [Apple Human Interface Guidelines: design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- [IBM Carbon: spacing](https://carbondesignsystem.com/elements/spacing/overview/) and [semantic themes](https://v10.carbondesignsystem.com/guidelines/themes/overview/)
- [Material Design 3: canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/)
