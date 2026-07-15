# Shared minigame foundation

Status: foundation only. No production engine is registered and no existing mission game is replaced.

## Runtime boundaries

- Phaser is pinned to `3.90.0` and imported as a separate lazy Vite chunk.
- The normal welcome/returning path does not request Phaser.
- `renderHome()` schedules the Phaser chunk only after Home is rendered.
- A direct Game Lab URL may load Phaser immediately because the user explicitly requested a game.
- Game content comes from the bundled source adapter. Production engines must not read live Firestore content.
- The stage is silent and untimed. Phaser is created with `audio.noAudio: true`.
- The reference viewport is `390 × 844`; supported portrait width is `360–480`.

## Exact `GameInstance` contract

The root object must contain exactly these fields:

```js
{
  id,
  questionNumber,
  missionSlot,
  engineId,
  engineVersion,
  seed,
  mode,
  xp,
  title: { en, pt },
  prompt: { en, pt },
  insight: { en, pt },
  assets: { baseImage, layers, masks },
  layoutOverrides,
  payload,
}
```

- `id`, `engineId`, and `seed`: non-empty stable strings.
- `questionNumber`: positive integer.
- `missionSlot`: integer `0–3`, preserving four games plus one separate quiz per question.
- `engineVersion`: semantic version such as `1.0.0`.
- `mode`: exactly `lab` or `mission`.
- `xp`: non-negative integer.
- `title` and `prompt`: exact `{ en, pt }` objects with non-empty strings.
- `insight`: exact `{ en, pt }` object; empty strings are permitted.
- `assets.baseImage`: `null` or a non-empty string; `layers` and `masks`: string arrays.
- `layoutOverrides` and `payload`: objects. Engine-specific payload rules belong in `engine.validate()`.
- Unknown root, localized-text, or asset fields are rejected.

## Engine interface

Every versioned engine registration implements all eight methods:

```js
{
  validate(payload, instance),
  createScene(context),
  serializeState(scene, instance),
  restoreState(scene, savedState, instance),
  evaluate(scene, instance),
  getAccessibleActions(scene, instance),
  showHint(scene, hintIndex, instance),
  destroy(scene, instance),
}
```

Required behavior:

- `validate` returns `{ ok, errors }` and checks only engine payload/layout rules.
- `createScene` returns one Phaser scene instance. The context supplies `Phaser`, `instance`, `language`, `reducedMotion`, `onStateChange(scene)`, and `onReady(scene)`.
- `serializeState` returns JSON-safe partial state after every meaningful interaction.
- `restoreState` accepts `null` and must recreate a clean initial state; it also accepts older compatible partial state for resume.
- `evaluate` returns `{ correct, complete, feedback: { en, pt } }` without awarding XP.
- `getAccessibleActions` returns HTML-control definitions shaped as `{ id, label: { en, pt }, disabled?, run }`.
- `showHint` receives zero-based hint index `0` or `1` and returns localized feedback.
- `destroy` removes engine-owned listeners and objects. The shell then destroys Phaser.

Engines must support pointer drag where relevant, tap-select/tap-target, and keyboard equivalents. Accessibility cannot depend on canvas semantics alone.

## Shell policy

- Phaser owns only the visual game surface.
- Instructions, Check, Hint, result feedback, Reset/Replay, and accessible action buttons are HTML.
- Game Lab permits unlimited Reset and Replay, with two hints per run.
- Mission mode hides Reset/Replay and locks after the first Check submission, correct or wrong.
- Partial state, hint use, and the mission submission lock are stored locally by instance, mode, and engine version.
- Result normalization is separate from XP or Firestore logic. Mission integration receives one normalized result through the result adapter/event hook.
- Reduced-motion preference is passed into every engine and disables shell animation/transition behavior.

## Game Lab

Open the non-production proof fixture at:

```text
?lab=foundation-skeleton-v1&lang=en
```

It proves lazy Phaser loading, the full-screen shell, drag, tap-select/tap-target, keyboard/HTML alternatives, local resume, two hints, Reset/Replay, evaluation, and result adaptation. It is registered with `production: false` and cannot resolve in mission mode.

## Exact engine worktree instructions

Use one worktree and one branch per engine. Start every engine branch from the committed foundation baseline; never branch from another engine.

```sh
cd "/Users/paterjoachim/Documents/YOUCAT Learning Platform/event-demo"
git worktree add "../event-demo-engine-<engine-id>" -b "agent/minigame-<engine-id>" <FOUNDATION_COMMIT>
cd "../event-demo-engine-<engine-id>"
npm ci
```

In that worktree:

1. Add only `src/minigames/engines/<engine-id>.js`, its bundled fixtures/assets, and focused tests.
2. Do not edit existing legacy renderers (`src/wordsearch.js`, `src/image-shuffle.js`, or their `src/main.js` handlers).
3. Do not add Firebase reads or writes. Use `createBundledGameSource` and the exact `GameInstance` contract.
4. Register the engine by exact `engineId@engineVersion`; mark it `production: true` only after supervisor review.
5. Implement all eight interface methods and JSON-safe partial resume.
6. Provide drag when relevant, tap-select/tap-target, keyboard controls, and meaningful HTML accessible actions.
7. Keep the engine silent and untimed; honor `reducedMotion` and use only Love Forever white/graphite/red-pink tokens.
8. Add a Game Lab fixture without changing mission selection or the four-games-plus-one-quiz content structure.
9. Run `npm run check` and `npm run build`.
10. Commit only that engine's scoped files, then report the branch and commit to the supervisor. Do not merge, rebase, or cherry-pick other engine branches.

The supervisor reviews each engine in Game Lab at `390 × 844`, then integrates the engine commit into the shared integration branch and runs the full suite again.
