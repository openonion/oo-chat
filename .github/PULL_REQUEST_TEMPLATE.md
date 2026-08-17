## Change

<!-- What product outcome does this PR deliver? -->

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

Attach at least one real screenshot from the completed E2E run **in this PR
body**. CI artifacts remain the source archive, but a reviewer must not need to
start an environment or download an artifact to see the latest UI. For a
responsive UI change, attach both the primary desktop state and the narrow/mobile
state.

<!-- e2e-screenshots:start -->
<!-- Paste GitHub-uploaded Markdown images here, for example:
![E2E — Work Room desktop](https://github.com/user-attachments/assets/REPLACE)
![E2E — Work Room mobile](https://github.com/user-attachments/assets/REPLACE)
-->
<!-- e2e-screenshots:end -->

The `Visual E2E evidence declaration` check requires a non-placeholder image
inside this section. Do not replace it with a prose link.

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
