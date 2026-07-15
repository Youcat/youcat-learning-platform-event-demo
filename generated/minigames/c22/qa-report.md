# C22 Magnetic Field — UI/UX QA

Owner: `agent/minigame-c22`

Reference viewport: `390 × 844`

Browser: Codex in-app browser against the running Vite application

| Checklist item | Result | Evidence |
|---|---|---|
| 390 × 844 stage, no horizontal scroll | Pass | Live DOM: `scrollWidth 390`, viewport width `390`; initial and completed PNGs. |
| 360, 390, 480 controls visible and reachable | Pass | Live checks at `360 × 800`, `390 × 844`, `480 × 900`; essential controls stayed visible or reachable by a short vertical scroll. |
| Love Forever palette, no yellow | Pass | White, graphite, approved gray, `--love-red`, and semantic error red only; canvas focus ring explicitly uses `--love-red`. |
| Fira Sans and restrained type scale | Pass | Live computed body family is Fira Sans; title 22/28, prompt 15/22. |
| Borders/spacing establish hierarchy | Pass | No gradient, blur, glow, shadow, floating cards, pills, or oversized radii. |
| Decorative marks are restrained | Pass | Sparse dashed boundaries, field lines, two stick figures, and one low-opacity approved artwork reference. |
| EN/PT objective and interaction stated | Pass | Both lab URLs show localized drag, tap-target, and controls guidance. |
| Check, Hint, feedback are HTML | Pass | DOM snapshot exposes buttons and polite status outside canvas. |
| Pointer drag | Pass | Dragged Friend A in the running game; selected state and position updated. |
| Tap-select/tap-target | Pass | Selected Friend B on canvas and moved it to a tapped target. |
| Keyboard and accessible actions | Pass | Canvas-focused arrows changed state; equivalent HTML select/move buttons remained available. |
| Targets at least 44 × 44 | Pass | Live minimum button height was 44 px; primary and accessible actions were 48 px. |
| No hover/sound/timer/motion dependency | Pass | Zero audio/video elements, no timer text, no animated elements, direct state changes only. |
| Invalid actions recover safely | Pass | Bounds/overlap moves are rejected without state mutation; focused test passes. |
| Useful canvas accessible name | Pass | Canvas role/name includes title and complete task prompt. |
| Linear focus order and labels | Pass | Back → canvas → figure selection → movement → debrief → Reset/Replay/Hint → Check. |
| Arrow/Space/Enter do not trap page | Pass | Arrow handling runs only while canvas is focused; HTML buttons retain normal keyboard behavior. |
| Polite live feedback | Pass | Feedback uses `role=status` and `aria-live=polite`; selection and invalid-move status are textual. |
| 200% text-zoom resilience | Pass (layout audit) | Flow layout has no fixed copy height; narrow 360 px and long Portuguese copy showed no clipped prompt or button. |
| Reduced motion | Pass | Normal state already has zero animated elements; engine creates no tweens and honors the supplied flag. |
| Silent and untimed | Pass | Phaser uses `audio.noAudio`; no timer or time-based evaluation. |
| Reload restores partial state | Pass | Live tab replacement restored explored positions and selected debrief; JSON resume test passes. |
| Other engine version ignored | Pass | Existing versioned persistence test passes. |
| Lab Reset/Replay and two hints | Pass | Reset and Replay cleared the run live; hint count moved 2 → 1 → 0 with escalating feedback. |
| Mission one submission | Pass | Shell locks Check after the first mission result; persisted `submitted` state and integration guard are tested. |
| Result/XP separation | Pass | Engine evaluation has no XP side effect; normalized XP test awards 8 only for correct + complete. |
| Bundled source, no Firebase content read | Pass | Fixture resolves through `createBundledGameSource`; registration module contains no Firebase import. |
| Exact production registration | Pass | `C22@1.0.0`, `production: true`; focused registry test passes. |
| Four games plus one quiz | Pass | Q59 types are C22, image-shuffle, reveal, wordsearch, plus one quiz. |
| Focused and full tests | Pass | 11 C22 tests; 35 total tests pass. |
| Production build/lazy Phaser | Pass | Vite build passes; Phaser emitted as its own `phaser-*.js` chunk. |
| Required state review | Pass | Initial, mid-play, completed PNGs plus live hint, incorrect, resumed, and zero-animation reviews. |
| Unrelated files preserved | Pass | Diff is limited to C22 engine/fixture/asset/tests, registration, Q59 slot 0, and narrow shared adapters/styles. |
