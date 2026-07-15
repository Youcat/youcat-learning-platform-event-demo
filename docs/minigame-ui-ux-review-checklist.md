# Objective minigame UI/UX review checklist

Record Pass/Fail, evidence, and owner for every item before an engine is enabled for missions.

## Scope and identity

- [ ] At `390 × 844`, the stage fills the portrait viewport without horizontal scrolling.
- [ ] At widths `360`, `390`, and `480`, essential controls remain visible, readable, and reachable.
- [ ] The palette is only Love Forever white, graphite, red/pink, approved gray/borders, and semantic error red; no yellow accent appears.
- [ ] Fira Sans is the only UI family; title is `22/28` or smaller and body is `15/22`.
- [ ] Borders, spacing, and line weight provide hierarchy; there are no gradients, blur, glow, dramatic shadows, floating cards, or oversized radii.
- [ ] Decorative marks are restrained and do not resemble generic AI/SaaS styling.

## Interaction

- [ ] The first screen states the objective and the available interaction in English and Portuguese.
- [ ] Check, Hint, and feedback are HTML controls/content rather than painted into canvas.
- [ ] Relevant direct manipulation works by drag.
- [ ] The same task works by tap-select followed by tap-target.
- [ ] The same task works by keyboard and/or the visible accessible action controls.
- [ ] Every HTML target is at least `44 × 44` CSS pixels and has a visible focus state.
- [ ] No success depends on hover, sound, a countdown, rapid response, or motion.
- [ ] Invalid actions leave state recoverable and return concise feedback.

## Accessibility and comfort

- [ ] Canvas has a useful accessible name; the complete task is operable through surrounding HTML controls.
- [ ] Control order, labels, disabled state, and feedback are correct with VoiceOver/TalkBack-style linear navigation.
- [ ] Arrow/Space/Enter behavior does not trap focus or prevent normal page navigation outside the canvas.
- [ ] Feedback uses a polite live region and does not rely on color alone.
- [ ] At 200% text zoom, controls and copy do not overlap or clip.
- [ ] `prefers-reduced-motion: reduce` removes non-essential transitions and the engine honors the supplied flag.
- [ ] The game is silent and contains no timer UI or timer-dependent evaluation.

## State and governance

- [ ] Reload during play restores meaningful partial state from local persistence.
- [ ] A saved state from another engine version is ignored safely.
- [ ] Game Lab offers unlimited Reset and Replay and exactly two hints per run.
- [ ] Mission mode offers no Reset/Replay and accepts exactly one Check submission, correct or wrong.
- [ ] Result output contains no XP side effect; it passes through the result adapter once.
- [ ] The fixture comes from the bundled source adapter and performs no live Firestore content read.
- [ ] The engine is registered by exact id/version, and a non-production engine cannot resolve for a mission.
- [ ] Mission content still contains four games and exactly one quiz per question.

## Verification evidence

- [ ] Focused contract, state, and engine tests pass.
- [ ] Full `npm run check` passes.
- [ ] Production `npm run build` passes and Phaser is emitted as a separate lazy chunk.
- [ ] Screenshots are reviewed at `390 × 844` for initial, partial, hint, incorrect, correct, resumed, and reduced-motion states.
- [ ] No unrelated inherited files were reverted or discarded.
