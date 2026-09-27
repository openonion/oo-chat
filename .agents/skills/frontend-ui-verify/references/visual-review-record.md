# Visual comparison and verification record

Copy this structure into the active project's evidence report. Keep the record about the current change; do not write results back into this template. A screenshot-only review leaves interaction checks pending.

## Scope and evidence

- Task / intended next action:
- Build / commit / URL under review:
- State and representative content:
- Viewport width × height, zoom, scroll position, theme, device / runner:
- Before screenshot and build:
- After screenshot and build:
- Reference IDs, source URLs, publication / capture dates, local image paths:
- Reference type: live website capture / official demo / detail crop / historical screen:
- Comparison limits (different content, scale, theme, platform, idealised state):

## Three required comparison answers

| Question | Verdict | Specific visible evidence |
| --- | --- | --- |
| Did we achieve the intended effect? | reached / partial / missed / unknown | Reference region → implementation region |
| Is the relevant craft comparable in this state? | reached / partial / missed / unknown | Hierarchy, space, reading, alignment, content and action |
| Where is the largest gap? | ordered gaps | Region → user impact → concrete next change |

Avoid a numerical beauty score. When no suitable reference exists for a state, mark that comparison unknown and evaluate it against the product standard; do not infer a match from a different state.

## Functional checks

Record passed / failed / not tested with evidence for the applicable checks: main flow and recovery, viewport overflow, keyboard and visible focus, accessible names and contrast, touch targets, scrolling, reduced motion, long / streaming content, errors and approvals. Link commands and browser results already produced; do not rerun unrelated suites just to populate this form.

## Independent design critique

- Reviewer: identify as AI when applicable.
- Actual implementation and reference images inspected:
- Biggest remaining issues, with image regions and user impact:
- Verdict: pass / revise / pending, scoped to named states.

| Iteration | Criticism | Change | New screenshot | Follow-up verdict and reason |
| --- | --- | --- | --- | --- |
| Initial review | | | | |

## Final status

- Functional verification: pass / fail / pending, with scope.
- Reference comparison: reached / partial / missed / unknown, with scope.
- Independent visual review: pass / revise / pending, with scope.
- Remaining limitations and next check:

Do not collapse these statuses into “production-ready.” A favourable reference image cannot prove an untested interaction, and passing browser tests cannot dismiss a visual critique.
