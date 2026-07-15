# A7 Stained-Glass Restoration — QA record

Owner: Codex (`agent/minigame-a7`)

Date: 2026-07-15

Fixture: `?lab=A7&lang=en` / `?lab=A7&lang=pt`

## Scope and identity

| Result | Evidence |
| --- | --- |
| Pass | 390×844 fills the portrait viewport with no horizontal scroll. |
| Pass | 360×800, 390×844, and 480×900 retain visible, readable, reachable essential controls. |
| Pass | Palette is white, graphite, approved gray/borders, and Love Forever red/pink only. |
| Pass | Fira Sans is the only UI family; title is 22/28 and body is 15/22. |
| Pass | No gradient, blur, glow, shadow, floating card, oversized radius, or generic decorative treatment. |
| Pass | Existing approved Q68 Love Forever artwork is reused; no generated illustration was added. |

## Interaction

| Result | Evidence |
| --- | --- |
| Pass | EN/PT first screen names the objective, drag, tap-select/tap-target, and accessible controls. |
| Pass | Check, Hint, feedback, Reset, Replay, and accessible actions are HTML. |
| Pass | Live pointer drag placed a matching shard. |
| Pass | Live wrong-target drag was rejected immediately and returned the shard safely. |
| Pass | Live tap on the Freedom shard followed by its silhouette placed it. |
| Pass | Live canvas Arrow/number selection plus Enter placement worked. |
| Pass | Live HTML action selection and placement worked. |
| Pass | All HTML targets measured at least 44 CSS px high and have the shared visible focus treatment. |
| Pass | No hover, audio, countdown, speed, or motion dependency. |

## Accessibility and comfort

| Result | Evidence |
| --- | --- |
| Pass | Canvas is focusable, role `application`, and has a localized objective/instruction label. |
| Pass | DOM order is Back → canvas → shard actions → Reset/Replay/Hint → Check. |
| Pass | Every operable state is exposed through visible localized HTML buttons. |
| Pass | Feedback uses `role=status` and `aria-live=polite`; meaning is expressed in text, not color alone. |
| Pass | Enlarged-text browser check reported no clipped heading, paragraph, or button content. |
| Pass | Engine has no animation or transition; the shell also applies its reduced-motion rule. |
| Pass | No audio/video elements, timer text, audio engine, or time-based evaluation. |

## State and governance

| Result | Evidence |
| --- | --- |
| Pass | Partial state is JSON-safe and restored from local versioned persistence. |
| Pass | Another engine version is ignored safely; malformed saved state resets to the seeded initial state. |
| Pass | Lab supplies Reset, Replay, exactly two escalating hints, and repeatable Check. |
| Pass | Mission hides Reset/Replay, accepts one Check, reveals solution/insight, and normalizes one result. |
| Pass | Exiting before mission submission leaves the active mission and persisted engine state intact. |
| Pass | XP is absent from `evaluate`; the result adapter awards mission XP only for correct+complete. |
| Pass | Fixture is bundled and A7 is registered exactly as `A7@1.0.0`, production enabled. |
| Pass | Q68 remains four games plus one quiz; only human game 4 / mission slot 3 is replaced. |

## Verification

| Result | Evidence |
| --- | --- |
| Pass | `npm run check`: 37/37 tests passed. |
| Pass | `npm run build`: succeeded; Phaser emitted as a separate lazy chunk. |
| Pass | Final running-browser screenshots: initial, meaningful partial, completed/debrief at 390×844. |
| Pass | Portuguese at 390×844 has no horizontal overflow; localized button text is not clipped. |

Asset provenance: `a7-restoration.webp`, shard layers, and masks are optimized crops/partitions derived from the approved repository artwork `src/assets/illustrations/games/question-068-definitive-yes.png`.
