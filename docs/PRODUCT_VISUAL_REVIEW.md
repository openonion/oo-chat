# O Chat visual review and design direction

**Reviewed:** 2026-09-26. **Scope:** the current PR screenshots for first use, Explore, agent profile, conversation, approval, and mobile settings, plus the components that render them. The ten findings below describe the baseline. The implementation and new evidence are recorded at the end. Some screenshots contain fixture agents and fixture replies, so the critique concerns O Chat's presentation of that content, not the agent's response quality.

The target standard and brand tokens live in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). The migration is tracked in [oo-chat#253](https://github.com/openonion/oo-chat/issues/253).

## 1. What strong product designers would ask

These are **our design-review questions inferred from published principles**, not quotations attributed to an individual designer.

1. In five seconds, can a new visitor tell what an agent can do, what they must provide, and what happens after they start?
2. Does the most prominent element help the current task, or is it only a headline, avatar, border, or animation?
3. Does each screen show the real object being worked on and the current state of that work? Can the user find the next action without reading the whole page?
4. Does “online” communicate only connection, or does the surrounding UI accidentally imply trust, access, or readiness to perform a task?
5. When an agent asks for permission, can the user understand the exact action, scope, consequence, and available choice before tapping a button?
6. Do navigation, conversation, controls, and status form one predictable hierarchy on both phone and desktop?
7. Are repeated micro-details—alignment, type weight, optical icon size, border weight, focus, motion, copy—consistent enough that the interface feels deliberately made?
8. Does the interface still make sense with one agent, a long task, an offline agent, a pending approval, or incomplete published profile data?

[Apple's design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) emphasise purpose, agency, truthful feedback, hierarchy, and craft. [Linear's account of its 2026 UI refinement](https://linear.app/now/behind-the-latest-design-refresh) explains how it reduced attention spent on navigation chrome, excess icons, and borders while preserving useful information density. These are useful standards for O Chat; our specific answers must come from its Agent workflows.

## 2. Point of view

The design goal is **calm control over real Agent work**. O Chat should help someone discover a capable agent, understand its boundaries, start a task, and supervise the result. The product should feel quietly capable and trustworthy, with enough detail to support a decision. “Simple” means the next step is clear; it can require *more* context about a task or approval. Apple's [design discussion](https://developer.apple.com/videos/play/wwdc2026/250/) explicitly separates simplicity from removing useful information. Linear describes a similarly calm but information-rich workspace in its [UI refresh](https://linear.app/now/behind-the-latest-design-refresh).

The first design move is therefore to give actual work a stronger place in the composition. A capability description, current run step, or pending decision should carry more weight than a product slogan or generic card frame. The second is to make the shell recede so the working surface is unmistakable. The third is to establish one semantic grammar for identity, access, operational state, and action. Icon polish and motion matter after those relationships are right.

## 3. The most visible problems

| Priority | Observation and evidence | Why it feels unfinished | Design response |
| --- | --- | --- | --- |
| 1 | [First-use desktop](e2e-evidence/ui-refinement/home-explore.png): giant serif promise, second large logo, one black Explore button, address form, broad unused canvas. | The first screen resembles an onboarding template. It says “find an agent” without showing an Agent's work. | Show a compact introduction plus at least one genuine capability preview or a purposeful live/empty state. Keep direct address entry visible but secondary. |
| 2 | [Explore desktop](e2e-evidence/ui-refinement/explore-desktop.png) and [phone](e2e-evidence/ui-refinement/explore-mobile.png): the task summary is a single ordinary line; raw address and “Also: Summarise” compete with it. | The most useful fact is not the strongest visual element. A one-result view feels sparse despite having useful data. | Put task title and outcome first; place identity, model/address, availability, and secondary capabilities in subordinate positions. Handle sparse results with intentional layout rather than filling the screen with hero space. |
| 3 | [Agent profile desktop](e2e-evidence/ui-refinement/agent-capabilities-desktop.png): model/version/address/balance/share form a visual band above tasks; Start is a faint link on each capability. | Technical metadata is more prominent than the reason to choose the agent. | Lead with the agent's outcome and one clear task entry. Move model/version/address into inspectable details; keep price/access near the decision they affect. |
| 4 | [Conversation desktop](e2e-evidence/ui-refinement/chat-after.png): white transcript, a small reply, large blank middle, nested agent/conversation box in the sidebar. | The work surface has little rhythm or evidence of progress; the sidebar card has more visible structure than the conversation. | Reduce sidebar contrast and nesting; give messages, tool activity, and current work a stable reading column and clear grouping. Use a purposeful empty state when no work exists. |
| 5 | [Approval phone](e2e-evidence/ui-refinement/approval-mobile-after.png): command, decision buttons, “Other review options,” “Approval needed,” “Answer above,” and “Jump” are dispersed. | The user must assemble the meaning of one decision from several locations. The secondary wording is vague. | Make the pending decision one coherent surface: action and scope, reason/risk when available, then choices. Link the composer state to that decision with exact copy. |
| 6 | [Settings phone](e2e-evidence/ui-refinement/settings-mobile-after.png): panel inside section inside a rounded card, then bordered values inside it. | Every layer asks for attention; borders carry structure that type and spacing should carry. | Use one page section and aligned rows; reserve a distinct surface for the recovery warning and genuinely editable fields. |
| 7 | Across [first use](e2e-evidence/ui-refinement/home-explore.png), [Explore](e2e-evidence/ui-refinement/explore-desktop.png), and [chat](e2e-evidence/ui-refinement/chat-after.png): large editorial serif, compact utilitarian chat type, and tiny mono metadata vary in emphasis. | The product shifts visual voice between screens. Repeated 11 px labels in `components/sidebar.tsx` and settings demand close reading. | Define roles by job: a restrained serif introduction, sans working UI, mono only for machine values, readable secondary text. |
| 8 | `app/globals.css` uses green `brand-*` across online state, interaction focus, success, and code additions. | One colour has several meanings. Brand identity is mostly confined to the logo, while the UI's semantics blur. | Introduce semantic identity, status, attention, danger, and code-diff roles. Migrate each use according to meaning. |
| 9 | [Agent profile phone](e2e-evidence/ui-refinement/agent-capabilities-mobile.png): the second capability starts just above the fixed composer, while small “Start” links, pills, and metadata compete in the remaining height. | The most useful content is interrupted at the point where the user is deciding what to try. | Reduce profile chrome; preserve space above the composer and make task entry easier to see and tap. Verify scroll and safe area at 320–390 px. |
| 10 | Hover lifts on Explore cards, staged page reveal, pulsing presence, rotating Settings icon, and mixed rounded shapes appear in separate components. | Each flourish is locally plausible, but together they lack one motion and shape grammar. | Keep motion for feedback and state transitions. Standardise optical icon size, control radius, hover/focus treatment, and border weight; remove ornamental animation from routine navigation. |

The underlying problems are **priority, semantic consistency, and compositional craft**. The icon family is mostly consistent; replacing all icons would address little of the above. Profile data quality also limits the result: the UI should display incomplete data honestly, and [connectonion#1787](https://github.com/openonion/connectonion/issues/1787) tracks better public agent profiles.

## 4. Overall style: a composed Agent workbench

**Character:** quiet, exact, humane. The black contour and layered lavender of the [actual onion mark](../public/onion.png) provide identity; a pale neutral shell and white working surface keep the Agent's task readable. Near-black anchors primary actions. Dark violet identifies selection and focus; green, amber, and red carry operational meaning. The product's distinctiveness comes from honest Agent substance and meticulous alignment, rather than decorative gradients or oversized empty space.

**Desktop anatomy:** a subdued navigation rail; a stable agent/context header; a central transcript or task view with a readable line length; an anchored composer; a contextual decision surface only when work requires one. A decision should never be visually lost among chat messages. A one-agent view must still look intentional.

**Phone anatomy:** compact identity and state in the top bar; the transcript or capability list gets the main height; the composer respects the safe area; a pending decision remains reachable and unambiguous when the keyboard is open. A small screen should change composition, not drop the task context.

**Visual grammar:**

- **Typography:** one primary text style for work, one readable secondary style, one restrained metadata style. Avoid 11 px for information users must act on. Keep line heights relaxed for explanations and tight for controls. Serif is a short introduction, not the operating language.
- **Spacing and alignment:** align avatars, labels, card text, buttons, and status to shared axes. Use proximity to show relationship before adding a line. [Atlassian's spacing guidance](https://atlassian.design/foundations/spacing) describes this semantic role of proximity.
- **Surfaces:** the transcript is the canvas. A sidebar row is a row, not a card nested in another card. Tool output, approval, and dialog earn stronger surfaces because they have different responsibilities. Use shadows primarily for overlays.
- **Status:** pair text with shape/icon and colour; keep online, running, waiting for user, succeeded, and failed distinct. Put status next to the object it describes. [Carbon's status guidance](https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/) cautions against colour-only signals.
- **Controls:** a prominent task action, restrained secondary actions, exact verbs, and visible keyboard focus. Explain disabled actions near the control. Do not use “Start,” “View,” or “Other options” when the specific action can be named.
- **Motion:** short feedback for opening, selection, and state transitions; no routine staggered entrance or perpetual breathing on the critical path. Reduced motion must preserve every state cue.
- **Assets:** use the original onion mark at a scale where it reads. Use a consistent agent identity treatment; do not make every agent a black initial tile if richer published identity exists. Heroicons can remain if optical size and stroke are standardised.

**Signature details to prototype together, then validate in context:**

1. A slightly tinted navigation rail separated from the white work canvas by one hairline. The selected destination uses a soft lavender field and a narrow dark-violet edge, so selection is clear without another boxed card.
2. A compact agent header with name, one useful description, and a labelled availability/access state on a shared baseline. Put raw address, model, and version behind a secondary detail action unless the task specifically needs them.
3. User turns in a soft lavender-tinted surface with dark text; Agent prose on the white reading canvas; tool activity as a restrained neutral inset; approval as a distinct attention surface. This gives each kind of content a readable role without making every message a competing card.
4. One composer surface with aligned add, text, voice, and send controls. Its status line should say exactly whether the Agent is working, waiting for the user, disconnected, or ready; a waiting state should link to the precise decision in the transcript.
5. A capability preview built around a concrete verb and outcome, with clear access and a named action. One excellent real example is more convincing than a grid of generic summaries. When published data is thin, say what is unknown and offer an honest next step.

These are prototypes for the next UI pass, not decisions already validated by users. Compare them against the current screens with the same content and revise what does not improve comprehension or control.

## 5. Implementation sequence and review gate

1. **First-use + Explore:** make real Agent tasks and access meaning the first visual evidence. Prove the one-agent, many-agent, no-agent, and poor-profile states.
2. **Agent profile + conversation:** establish common identity, task, transcript, tool activity, and composer hierarchy. Make the selected Agent and current work legible without promoting technical metadata.
3. **Approval + settings:** make consequential decisions self-contained; simplify nested settings surfaces and recovery language.
4. **System pass:** migrate semantic tokens, type roles, icon sizing, border/radius rules, focus, and motion across shared components. Compare before/after screenshots with the same populated state at 390, 768, and 1280 px, plus a narrow phone and long-content case.

A screen is ready for review when a person can identify **what this Agent can do, what is happening now, and what they can do next** without decoding interface chrome; online/access/approval states remain truthful; and the same visual roles behave consistently across screens. Browser tests and screenshots establish functional and visual evidence, while real users and further iteration remain necessary to judge whether the style feels excellent in use.

## 6. September 2026 implementation and visual check

The real registry review exposed an additional density issue that a one-Agent fixture did not: two stacked previews pushed direct address entry below the desktop viewport. First use now shows two previews side by side on desktop and one complete preview with a directory link on phones. The sidebar says “Your agents” to distinguish saved connections from directory-wide availability. [Desktop evidence](e2e-evidence/ui-redesign/home-multiple-desktop.png) and [phone evidence](e2e-evidence/ui-redesign/home-multiple-phone.png) use scripted profiles; private live-registry screenshots are not published.

The UI pass addresses the ten baseline findings together:

| Findings | Change |
| --- | --- |
| 1–2 | First use previews actual online Agent tasks; Explore and first use use the same task-first card, with honest loading, empty, and unavailable states. |
| 3, 9 | The Agent page shows capabilities before address, version, and sharing details. Task actions are more legible and the phone composer uses less vertical space. Balance and top-up remain near the identity where they affect whether work can start. |
| 4–5 | The sidebar is a quiet navigation rail; user turns, Agent replies, activity, and approval have distinct surfaces. Approval actions and explanation stay together, and the composer points back to the pending decision. |
| 6–8 | Settings sections use fewer nested borders, recovery risk has a clear attention treatment, secondary text is more legible, and violet identity tokens now separate selection/focus from green online status. |
| 10 | Routine reveal, breathing, hover lift, and rotating navigation motion were removed from the main path. |

The same fixture states have new browser captures under [`e2e-evidence/ui-redesign/`](e2e-evidence/ui-redesign/): [first use](e2e-evidence/ui-redesign/a-new-visitor-can-discover-an-online-agent-and-open-its-page--home-preview.png), [Explore](e2e-evidence/ui-redesign/a-new-visitor-can-discover-an-online-agent-and-open-its-page--explore-list.png), [Agent page](e2e-evidence/ui-redesign/a-new-visitor-can-discover-an-online-agent-and-open-its-page--agent-profile.png), [phone Agent page](e2e-evidence/ui-redesign/published-task-descriptions-remain-readable-before-chatting--landing-capabilities.png), [phone approval](e2e-evidence/ui-redesign/an-approval-is-answerable-primary-choices-are-on-screen-and-hittable--approval-primary.png), and [phone settings](e2e-evidence/ui-redesign/the-agent-row-shows-a-real-address-and-lays-its-tools-out-sideways--agents.png). These captures verify the hierarchy and layout with scripted Agent content; they do not substitute for a user study or a production data review.
