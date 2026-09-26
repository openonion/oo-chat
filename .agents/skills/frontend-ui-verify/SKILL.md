---
name: frontend-ui-verify
description: Verify a frontend's primary user flows, responsive layout, accessibility, and visual states in a real browser with reviewable evidence.
---

# Frontend UI verification

Use after a UI change or to reproduce a reported interface defect. This skill verifies behaviour and rendering; it does not prescribe a visual style. Read repository-specific test and evidence instructions first.

## Choose representative coverage

Run the project's focused deterministic test when available. Exercise the changed flow and the meaningful recovery path in a browser. Use realistic data: a populated state, long content, and relevant loading, empty, offline, approval, and error states. Identify the build or URL under test so local fixes are not confused with a deployed version.

At phone, intermediate, and desktop widths where layout changes, verify that the task order, next action, and content remain usable. Inspect keyboard order, visible focus, accessible names, contrast, reduced motion, and mobile touch behaviour. Measure horizontal overflow with DOM dimensions and inspect the offending element before fixing it.

Save screenshots where the project requires them, named by viewport and state. `/tmp` is suitable only for disposable exploration. Compare before and after at the same width and state. Report what passed, failed, and remains untested; link the visual evidence and include reproduction steps for defects.

Use the browser tool already available. `co browser` is optional when installed; prefer direct commands for deterministic steps. Verify the actual viewport after navigation. If the browser runner fails after a clean retry, switch to another available runner rather than repairing unrelated tooling.

## Report separate verdicts

Distinguish functional verification from visual design acceptance. In O Chat, follow the product skill’s independent screenshot critique loop. A viewport-bounds check proves that a control fits; it does not prove that the composition is readable, focused, or free of clutter. Report a design review as pending or revise when that review has not passed, even if every automated test is green.
