# O Chat home and ConnectOnion 1.8.9 verification

**Date:** 2026-09-29. **Runner:** Chromium / Playwright, laptop 1280 × 720 and phone 390 × 844, light mode, 100% zoom. **App:** production `https://chat.openonion.ai` before the change; local production build at `http://127.0.0.1:3337` after the change. **Host:** official PyPI `connectonion==1.8.9` in an isolated virtual environment and HOME.

## Reproduction and correction

- A clean production browser loaded `/api/agents/online` before any Explore click and showed the public `airbnb-ops` Agent on Home. The old `app/page.tsx` called `useOnlineAgents` as soon as the saved-Agent list was empty.
- `co init <isolated-project> --template co-ai --yes` created an identity and project configuration but did not start an Agent Host. Its address showed Offline on the public O Chat Agent page. Starting `co ai --port 28765 --no-listen` made local `/health` healthy and the same public address Online. The Host was then stopped.
- Home now leaves registry discovery to `/explore`. New visitors see Explore and direct-address cards; saved Agents show published skill summaries and recent work in separate cards. Offline actions lead to details, where the Host startup/deployment path is explained. An offline Agent page does not show a top-up action or an active task action.

## Visual comparison

| State | Evidence |
| --- | --- |
| Before, clean production Home | Screenshot stored locally at `/Users/changxing/projects/.artifacts/oo-chat-189-default/live-before-desktop.png` |
| After, first use | [Desktop](first-use-does-not-discover-agents-until-explore-is-opened--multiple-agents-desktop.png) · [phone](first-use-does-not-discover-agents-until-explore-is-opened--multiple-agents-phone.png) |
| After, two saved Agents | [Desktop](saved-agents-have-distinct-work-cards-without-opening-the-directory--saved-agents-desktop.png) · [phone](saved-agents-have-distinct-work-cards-without-opening-the-directory--saved-agents-phone.png) |
| Representative published catalog names | [Before: shared generic pictogram](saved-agents-catalog-before-generic-icons.png) · [After: desktop](saved-agents-with-real-catalog-task-names-have-distinct-visual-identities--saved-agents-catalog-desktop.png) · [after: phone](saved-agents-with-real-catalog-task-names-have-distinct-visual-identities--saved-agents-catalog-phone.png) |
| After, Explore and offline detail | [Explore](a-new-visitor-can-discover-an-online-agent-and-open-its-page--explore-list.png) · [offline Agent](the-landing-page-says-the-agent-is-offline.png) |

References inspected: P05 Raycast Store directory for capability and action hierarchy; P03 Linear structure crop for purposeful boundaries. P03 is only a detail crop and neither reference matches O Chat's full first-use state or permission model. O Chat keeps its own identity and access language.

| Question | Verdict | Visible evidence |
| --- | --- | --- |
| Did we achieve the intended effect? | Reached for Home | The directory card disappeared from first use; saved Agents have distinct work icons, capability rows, status, and recent-work context. |
| Is the relevant craft comparable? | Partial | Agent cards have a clear visual hierarchy and purposeful boundaries. The references do not show an equivalent full saved-Agent Home, so whole-screen equivalence remains unknown. |
| Largest remaining gap | Minor | Agent icons derive from actual published capabilities, not owner-provided artwork; unknown capabilities use a generic icon. Natural empty space remains when only a few Agents are saved. |

## Functional checks

- `next build --webpack` passed. The default Turbopack build could not create its CSS worker port in this local sandbox; it was not a code failure.
- Focused ESLint on modified source and tests passed. The unit suite passed 229/230 tests on the first run; the one Host-process test timed out after 10 seconds under restricted local process conditions and passed on an isolated rerun with local process access. The Home agent-picker browser test also passed.
- Browser tests: 20 of 21 in the initial `explore/offline/bad-address` run passed; one new test had an ambiguous locator because its fixture gave two Agents the same profile. The fixture was corrected and passed on rerun. The final visual iteration's `explore/offline` run passed 10/10 against a production build.
- The first-use browser test counted zero directory requests on Home and one after clicking Explore. The offline tests checked the disabled composer and actionable explanation. Desktop and phone screenshots were inspected for hierarchy and overflow.

## Independent AI design critique

The first screenshot review returned **revise**: content was top-heavy, cards repeated passive copy, and phone cards pushed Explore too low. The second iteration centered first use and put real published skills and recent work into Agent cards; an offline action conflict was corrected. After reviewing the resulting laptop screenshot against the user's updated concern, the independent AI reviewer withdrew its earlier visual pass: two similarly shaped text cards still felt empty. The next version replaced letter avatars with capability-derived icons, shortened labels, and made recent work an obvious link. Review again returned **revise** because a one-skill card was stretched to the two-skill card's height. The final version uses content-height cards in a narrower centered workspace, and removes the duplicate desktop Explore action. Independent AI review returned **pass** for this scoped 1280px saved-Agent Home: Agent identity, state, and next action are distinguishable without filler content. This is not a claim about every O Chat route.

## Production-content follow-up

After deployment, a browser with two previously saved public Agents (`airbnb-ops` and `oo`) revealed that both fell back to the same sparkle pictogram. The earlier mock used `deploy` and `research` names, so it had missed this real-content gap. The follow-up maps published property, image, setup, and scan skill names to distinct semantic pictograms. Deterministic before/after browser screenshots use the same public skill names with synthetic addresses and shortened descriptions; they include no customer data or conversation history. The before image was captured against the live production version; the after image was captured against the updated local production build. The independent AI reviewer first returned **revise** based on the observed duplicate icon, then inspected the new screenshot and returned **pass** for the two-Agent visual distinction. The Home still makes no directory request until Explore.
