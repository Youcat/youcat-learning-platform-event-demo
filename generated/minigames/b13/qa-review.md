# B13 Matching Pairs — QA record

Date: 2026-07-15

Fixture: `?lab=B13&lang=en` / `?lab=B13&lang=pt`

## Scope and identity

| Result | Evidence |
| --- | --- |
| Pass | Relationship Metro source, title, route model, station model, and completion artwork dependency were removed. |
| Pass | The replacement contains exactly Body/Soul, Dignity/Freedom, and Gift/Covenant, with approved Portuguese labels. |
| Pass | White, graphite, gray, and Love Forever red/pink are the only game colors. |
| Pass | Fira Sans is used throughout; there are no gradients, shadows, decorative cards, audio, timer, or score pressure. |

## Interaction and comfort

| Result | Evidence |
| --- | --- |
| Pass | Live browser tap-two interaction completed two pairs. |
| Pass | Live browser drag from Body onto Soul completed that pair. |
| Pass | Live focused-canvas Arrow/Enter interaction completed Gift/Covenant. |
| Pass | Six word targets render above the 44 CSS px minimum at 390×844. |
| Pass | Wrong pairs clear safely and preserve completed pairs. |
| Pass | Reduced motion is accepted; the engine has no required animation. |
| Pass | Reset, Replay, Hint, and the visible accessible-controls section are absent from the shared stage. |

## State and integration

| Result | Evidence |
| --- | --- |
| Pass | Breaking payload and persistence changes are versioned as `B13@2.0.0`. |
| Pass | Partial state is deterministic, JSON-safe, and invalid version-1 state falls back cleanly. |
| Pass | Bundled source and production registry resolve the exact version; Phaser remains lazy-loaded. |
| Pass | Q14 mission slot 1 remains B13, awards 9 XP only through result normalization, and Q14 retains four games plus one quiz. |

## Browser evidence

- `b13-en-initial-390x844.png`
- `b13-en-midplay-390x844.png`
- `b13-en-completed-390x844.png`
- `b13-pt-initial-390x844.png`

The three screenshots were captured from the running Vite app in headless Chrome at an emulated 390×844 viewport. The live input pass used the same route and browser runtime.
