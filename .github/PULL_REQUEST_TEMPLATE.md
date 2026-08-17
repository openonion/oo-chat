## Change

<!-- What product outcome does this PR deliver? -->

## User-visible change

- UI impact: <!-- yes | no -->
- Changed surfaces/routes: <!-- name the screen/state, or `none` -->
- Related issue/design decision: <!-- URL or `none` -->
- Core version: <!-- e.g. 1.7.0a17 -->
- React version: <!-- e.g. 0.4.2-alpha.15 -->
- O Chat commit: <!-- full final head SHA -->
- Evidence commit: <!-- full final head SHA; must match this PR's current head -->
- No-visual-change reason: <!-- required with the `no-visual-change` label -->

Do not set `UI impact: no` merely because a change is subtle. If a route,
component, style, interaction, loading/error state, or responsive layout can
render differently, it has UI impact. A maintainer must apply the
`no-visual-change` label before screenshots can be waived.

## Required complete E2E evidence

Every oo-chat PR must complete the single continuous `e2e/pr-evidence.spec.ts`
journey and attach its final result screenshot. The journey must prove:

- [ ] an invite code was entered and accepted;
- [ ] the Agent connected and received a prompt or skill request;
- [ ] Safe/Default, Plan, and bounded Full access mode transitions were exercised;
- [ ] the Agent updated Control Center and the updated state rendered;
- [ ] I inspected `pr-release-evidence-invite-prompt-modes-and-control-center--complete-flow.png` in the CI `pr-e2e-evidence` artifact.

Evidence run: <!-- paste the GitHub Actions run URL -->

Do not merge from unit tests or prose alone. If the screenshot is missing,
cropped, unreadable, or contradicts the assertions, the PR is not review-ready.

## Visible E2E screenshots — required

Attach direct, GitHub-uploaded Markdown/HTML images from the completed E2E run
**in this PR body**. An expiring Actions artifact or prose link is not a visual
review surface. Images must be produced from the final `Evidence commit` above,
and must not expose invite codes, identities, private paths, raw prompts, or
secrets.

For an existing visible surface, attach Before plus After desktop and narrow
(375–390px) mobile. For a genuinely new surface, write `New surface: <reason>`
under Before instead. Add the applicable critical states: running, approval,
rejected/denied, error/reconnect, completed/cancelled.

<!-- e2e-screenshots:start -->
### Before
<!-- Attach a direct image, or write `New surface: <reason>`. -->

### After — desktop
<!-- Attach the changed state directly. -->

### After — narrow/mobile
<!-- Attach the changed state directly. -->

### Critical states
<!-- Attach or caption the relevant approval, error/reconnect, and terminal states. -->

- [ ] I inspected every image at the final PR head.
- [ ] Images contain no secret, invite code, identity material, private path,
      customer data, raw reasoning, or sensitive prompt.
<!-- e2e-screenshots:end -->

The `Visual E2E evidence declaration` check verifies inline image presence,
desktop/mobile scope, Before/new-surface rationale, required version/commit
metadata, and the final-head SHA. It does not judge image aesthetics; review
does. Do not replace an image with a prose or artifact link.

## UI interaction audit — required for visible changes

For a visible UI change, record a short result for each item below and make the
attached E2E screenshots sufficient for a reviewer to verify it. For a change
with no visible UI effect, write `Not applicable — <why>` for every item.

- [ ] 1. First-glance hierarchy: the primary task, status and action are clear.
- [ ] 2. Primary action: no duplicate or competing action is introduced.
- [ ] 3. Sensitive actions: approval/permission context is visible before a decision.
- [ ] 4. Evidence: previews and status are current, truthful and bounded.
- [ ] 5. Progress: the current state and latest completed activity remain distinct.
- [ ] 6. Detail: history/raw technical detail is intentionally disclosed, not dumped.
- [ ] 7. Recovery: loading, error, Stop and reconnect states do not over-promise.
- [ ] 8. Desktop: no clipped controls, accidental overflow or unnecessary visual weight.
- [ ] 9. Mobile: the same primary action and navigation remain reachable at 375px.
- [ ] 10. Accessibility: focus, labels, keyboard flow and contrast remain usable.

Audit notes: <!-- link each notable assertion to its screenshot/test, or explain N/A -->
