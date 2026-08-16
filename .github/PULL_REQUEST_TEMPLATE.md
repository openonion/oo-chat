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
