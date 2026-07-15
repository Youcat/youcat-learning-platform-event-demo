# Reusable visual minigame framework for YOUCAT Love Forever

Research and concept catalogue for the Assisi event demo and the future mobile app
Date: 15 July 2026

## Recommendation in one sentence

Build a reusable **visual-metaphor game system**: the content editor supplies a picture or illustration prompt, a few terms, and one small structure such as an order, hierarchy, contrast, or causal chain; the app turns this into a short tactile game in which the action itself expresses the lesson.

## Framework-first clarification

The catalogue in this document is **not a proposal for thirty separately designed or coded games**. The recommended product has:

- a small fixed set of renderer components shipped with the app;
- a strict input schema for each component;
- a database record linking a question to a component and its content;
- deterministic, seeded level generation on the device;
- optional fixed visual themes that are also shipped with the app;
- no live design, coding, or image generation when a learner opens a question.

For example, “Bridge of Fidelity” is one permanent renderer. Question 3 can feed it four stages of mature love, while question 25 can feed it four stages of discernment. The stones, gestures, feedback, accessibility behavior, scoring, and animations remain identical. Only the approved content changes.

The key test is: **Would the interaction still communicate something if the labels disappeared?** If yes, the mechanic is likely strong. If the player is only moving text cards into boxes, it is still essentially a worksheet.

## What the research and reference products suggest

- Retrieval practice improves long-term retention and conceptual learning, so games should require the learner to reconstruct meaning rather than merely reread it ([Roediger & Karpicke](https://journals.sagepub.com/doi/pdf/10.1111/j.1467-9280.2006.01693.x); [Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)).
- Learning is stronger when the learning content is intrinsic to the game action. Players attend to what they must manipulate to succeed; a decorative game wrapped around unrelated questions wastes that advantage ([Cutting & Iacovides](https://pure.york.ac.uk/portal/en/publications/learning-by-doing-intrinsic-integration-directs-attention-to-incr/); [Habgood & Ainsworth](https://eric.ed.gov/?id=EJ922627)).
- Touch can carry meaning when the gesture fits the concept—connecting, balancing, pruning, repairing, revealing—not when it is arbitrary ([touchscreen-learning review](https://research.cuhk.edu.hk/en/publications/characterizing-touchscreen-actions-in-technology-enhanced-embodie-2/)).
- Visual cues should reveal structure, with words located beside the object or action they explain. This follows the signaling and spatial-contiguity principles of multimedia learning ([Cambridge Handbook of Multimedia Learning](https://www.cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/C98AB3A6CE760DD63C048936EA0B3B44)).
- Strong product references make abstract learning tactile: DragonBox gradually replaces images with algebraic symbols; Tinybop uses explorable models; Duolingo mixes automatically generated exercises with interactive scenarios; Brilliant teaches through guided visual problem-solving ([DragonBox](https://dragonbox.com/products/algebra-5), [Tinybop](https://tinybop.com/apps), [Duolingo](https://blog.duolingo.com/how-duolingo-experts-work-with-ai/), [Brilliant](https://brilliant.org/)).
- Especially relevant artistic references are *Florence*, where relationship dynamics become bespoke minigame gestures; *Gorogoa*, where illustrated panels combine into meaning; *Assemble with Care*, where restoration and reconciliation share one metaphor; *Prune*, where cultivation is a swipe; *Mini Metro*, where a network becomes the created artwork; and *A Little to the Left*, where visual organization is itself satisfying ([Florence](https://www.annapurna.com/interactive/florence), [Gorogoa](https://www.annapurna.com/interactive/gorogoa), [Assemble with Care](https://www.assemblegame.com/), [Prune](https://prunegame.com/support), [Mini Metro](https://dinopoloclub.com/games/mini-metro/), [A Little to the Left](https://store.steampowered.com/app/1629520/_/_/)).

These ideas are inspirations, not proposals to clone another game. The YOUCAT versions should use their own visual language, theological structure, characters, and pastoral tone.

## Input types

The catalogue below uses six small input types. A content author should never need to design a level manually.

- **Picture:** one supplied image, or one illustration prompt.
- **Terms:** 3–8 words or short phrases, optionally tagged as essential, distortion, virtue, obstacle, and so forth.
- **Sequence:** 3–7 ordered ideas or actions.
- **Roles:** terms tagged with structural roles such as root, foundation, means, fruit, center, or consequence.
- **Relations:** a tiny graph of concepts and their links, contrasts, or dependencies.
- **Scenario:** a one-sentence situation, 2–4 actions, and their consequences or feedback.

Effort is relative to the current vanilla JavaScript demo: **S** is mainly HTML/CSS/SVG, **M** needs a custom interaction component, and **L** needs more sophisticated animation, geometry, or content generation.

## Recommended runtime architecture

```text
Question record
    ↓ links to
Game-instance record (template ID + approved content + seed)
    ↓ validated by
Template schema stored in the app
    ↓ normalized by
Deterministic level builder
    ↓ rendered by
Fixed game component
    ↓ produces
Result, XP, answer review, and analytics
```

Keep the separation strict:

- **App code owns behavior:** layout rules, gestures, animation, feedback, scoring, accessibility, and difficulty rules.
- **Database owns meaning:** terms, images, relations, answer keys, reflection prompts, translations, and the chosen difficulty band.
- **AI may assist authors before publication:** extract a sequence, draft distractors, or prepare an illustration prompt. A human approves the record.
- **Runtime remains deterministic:** opening the same question with the same seed produces the same solvable level, including offline.

### Core database records

```json
{
  "questionId": 140,
  "gameInstanceId": "q140-seasons-v1",
  "templateId": "cycle_seasons",
  "templateVersion": 1,
  "localeContentId": "q140-seasons-en-v3",
  "difficulty": "normal",
  "seed": 140031,
  "content": {
    "title": "Love through the seasons",
    "stages": [],
    "insight": "Mature love remains active when feelings change."
  }
}
```

The static template registry in the app can look conceptually like this:

```js
const gameTemplates = {
  cycle_seasons: {
    version: 1,
    schema: seasonsSchema,
    buildLevel: buildSeasonsLevel,
    render: SeasonsGame,
    evaluate: evaluateSeasons,
  },
  sequence_path: {
    version: 1,
    schema: bridgeSchema,
    buildLevel: buildBridgeLevel,
    render: BridgeGame,
    evaluate: evaluateBridge,
  },
};
```

The current `approved-activities.js` objects already contain much of the required content—types, items, answer keys, starts, and insights. They can be migrated into database game-instance records while the display and interaction logic move into versioned template components.

## 30 minigame concepts

### A. Interiorising terms and images

| # | Minigame | What the player does and learns | Minimal generator input | Effort |
|---|---|---|---|---|
| 1 | **Lantern in the Fog** | Move a warm pool of light across an illustration. Meaningful objects awaken, animate, and reveal a key term. The term is remembered through a place and image, not a flashcard. | Picture + 3–6 term/hotspot pairs. Hotspots can be generated from separate illustrated objects. | M |
| 2 | **Prune What Chokes Love** | A plant grows toward the light. Swipe away thorny branches representing distortions while preserving branches carrying virtues; good choices cause flowers and fruit. The pruning gesture is the lesson. | Healthy terms + distortions + optional tree/scene prompt. | M |
| 3 | **Shadow of Meaning** | Rotate one or two curious objects until their shadow becomes a recognizable symbol—ring, heart, home, compass, open hands—then reveal the connected concept. This teaches recognition through discovery. | Term + definition + icon or silhouette prompt. | L |
| 4 | **Living Symbols** | Place small illustrated objects into a scene: a key opens trust, a bandage becomes care, a compass becomes discernment. Each placement transforms the scene and names the concept. | 3–6 terms + icon prompts + one scene prompt. | M |
| 5 | **Definition Lockbox** | Rotate concentric rings so icon, key word, and short meaning align. The box opens only when the three facets of a term are coherent. | 3–5 terms, each with a short definition and icon prompt. | S |
| 6 | **Room of Memory** | Place symbolic objects in a house—promise at the foundation, listening at the window, prayer at the hearth. A second round hides the labels and asks the player to retrieve them spatially. | Terms + semantic roles + optional room prompt. | M |
| 7 | **Stained-Glass Restoration** | Slide or rotate colored fragments into a broken window. Each correct fragment illuminates one key word; the completed window reveals the central sentence or illustration. | Picture/illustration prompt + 4–9 key terms. | M |
| 8 | **Fireflies of Meaning** | Essential words and small symbols drift through a dusk scene. Tap the ideas that belong to the reading; misconceptions dissolve rather than merely turning red. A very quick recall game. | Essential terms + plausible distractors + background prompt. | S |

### B. Seeing the structure of a text

| # | Minigame | What the player does and learns | Minimal generator input | Effort |
|---|---|---|---|---|
| 9 | **Bridge of Fidelity** | Place stepping stones in a meaningful order so two shores become connected. A misplaced stone tips or sinks; the final crossing animates. Ideal for stages, arguments, or a sequence of mature actions. | Sequence + optional distractors + bridge setting prompt. | S |
| 10 | **Mosaic of the Argument** | Fit irregular pieces into claim, reasons, example, tension, and conclusion. The silhouette shows the text’s architecture before the words are read back as a whole. | Short text parts tagged by rhetorical role + picture prompt. | M |
| 11 | **House That Love Builds** | Construct foundation, walls, openings, roof, and hearth with the concepts that play those roles. If the foundation is wrong, the house visibly remains unstable. | Terms tagged foundation/support/expression/protection/fruit. | S |
| 12 | **Constellation of Meaning** | Draw lines between stars to reconstruct the relations among concepts. Correct relations slowly form a recognizable symbol and a compact visual concept map. | 4–8 nodes + relation graph + optional final-symbol prompt. | M |
| 13 | **Relationship Metro** | Draw two or three colored routes through concept stations. Shared principles become transfer stations; broken routes show missing links. Useful for comparing attraction, friendship, covenant, and grace without a table. | Concept clusters + shared nodes + 5–10 terms. | M |
| 14 | **Roots, Trunk, Branches, Fruit** | Place ideas into a living tree according to whether they are sources, central convictions, practices, or outcomes. The whole hierarchy grows into view. | Terms tagged root/trunk/branch/fruit. | S |
| 15 | **Seasons of Love** | Rotate a circular landscape through spring, summer, autumn, and winter, then place the fitting virtue or action into each season. It shows that love persists while feelings and circumstances change. | 3–5 situations/stages + fitting responses. | S |
| 16 | **Perspective Panels** | Arrange, crop, or overlay two to four illustrated panels until partial truths reveal one complete scene—for example feeling + decision, body + soul, freedom + responsibility. | 2–4 facets + relation + layer/panel illustration prompts. | L |
| 17 | **Tapestry of the Text** | Weave colored threads representing themes through the right pegs. At crossings, shared concepts appear; the completed weave becomes a small image or quotation. | 2–4 themes + ordered nodes + shared relations. | M |
| 18 | **Ripple Map** | Drop one action into water and place its immediate, relational, and long-term consequences into widening rings. The finished animation makes causality visible. | Action + 3–7 consequences tagged by distance/time. | S |
| 19 | **Footprints and Crossroads** | Trace the author’s line of thought across a landscape. Correct stepping stones continue the footprints; tempting but incoherent steps wander into loops and return gently. | Sequence + 2–4 plausible detours + landscape prompt. | S |

### C. Experiencing the dynamics of love

| # | Minigame | What the player does and learns | Minimal generator input | Effort |
|---|---|---|---|---|
| 20 | **River of Decisions** | Guide a small boat through two or three forks. Each choice changes the riverbank, characters, and later options; the debrief names why consequences emerged. | Scenario + choices + short/long consequences + insight. | M |
| 21 | **Balance of Love** | Place principles or actions on a sculptural mobile until it becomes stable. This can express complements such as truth and mercy or closeness and freedom without reducing them to identical quantities. | Complementary principles + weighted actions + target state. | M |
| 22 | **Magnetic Field** | Adjust attraction, boundaries, and direction between two figures or symbols. The field changes visibly: fusion, isolation, orbit, or free relationship. Best used as reflection rather than a single “correct” moral score. | 2–4 forces + safe ranges + one reflection prompt. | M |
| 23 | **Compass of Discernment** | Rotate a compass through desire, reality, counsel, prayer, and responsibility. Only a coherent set points toward the next step; no single cue is allowed to commandeer the needle. | 4–6 discernment cues + one or two misleading cues. | S |
| 24 | **Repair Workshop** | Open a broken symbolic object and restore it with listening, truth, apology, amendment, patience, and grace. Parts must be installed in a sensible dependency order. | Object/picture prompt + repair steps + dependencies. | M |
| 25 | **Dialogue Jigsaw** | Conversation fragments have physical shapes. Listening opens space, defensiveness creates sharp edges, and an honest apology can join pieces that did not fit. The completed scene brings the characters visually closer. | 4–8 dialogue beats + speaker + tone/function tags. | M |
| 26 | **Keeper of the Flame** | Position shields around a flame while winds such as fatigue, fear, temptation, resentment, or routine arrive from different directions. The right concrete practices protect the flame without sealing it away. | Obstacles + corresponding practices + flame/setting prompt. | M |
| 27 | **Wellspring** | Open gates so water from a source reaches people, a home, or a garden. Self-enclosed channels stagnate; channels of self-gift become fruitful. This visualizes receiving and giving rather than mere possession. | Source + 3–6 actions/recipients + blockers or leaks. | M |
| 28 | **Orbit of Priorities** | Place values and daily actions in concentric orbits around a chosen center, then watch how repeated choices pull them inward or outward. This is a reflective self-portrait, not a scored answer. | Ranked terms or user-selected values + reflection prompt. | S |
| 29 | **Mirror of Truth** | Wipe fog from a mirror and align distorted statements with truthful clarifications. With each correction the reflection becomes less fragmented and more personal. | 3–6 misconception/truth pairs + mirror/character prompt. | S |
| 30 | **Covenant Rings** | Rotate several symbolic bands—freedom, totality, fidelity, fruitfulness, grace—until their matching expressions align and reveal one complete image. This makes a multidimensional definition graspable at a glance. | 3–5 dimensions, each with a matching phrase/icon. | S |

## Fixed template library

### Phase 1: eight templates for the Assisi demo

These give maximum visual variety while remaining realistic in the current browser-based, vanilla JavaScript architecture. Each is a single permanent component reused by every compatible question.

| Template ID | Permanent mechanic | Required database input | Built-in visual themes |
|---|---|---|---|
| `sequence_path` | Select or place items in order along a visual route. | 3–7 items + answer order + optional distractors. | Bridge, footprints, stepping stones. |
| `semantic_zones` | Place concepts into meaningful parts of one scene. | 3–8 items + role/zone for each. | House, tree, room, garden. |
| `assemble_image` | Reconstruct an image; solved pieces reveal terms or one insight. | Image asset + cut pattern + optional term per piece. | Stained glass, mosaic, torn poster. |
| `grow_prune` | Preserve helpful branches and prune harmful growth. | Helpful items + harmful items + optional growth stages. | Tree, vine, rose bush. |
| `cycle_seasons` | Rotate through stages and place the fitting response in each. | 3–5 stages + response per stage. | Seasons, day/night, pilgrimage cycle. |
| `cause_ripples` | Place consequences into near, relational, and long-term rings. | Trigger/action + 3–7 effects tagged by ring. | Water ripples, echo, growing circles of light. |
| `connect_map` | Connect nodes according to an approved relation graph. | 4–9 nodes + correct edges + optional clusters. | Constellation, metro, tapestry. |
| `dialogue_fit` | Build a conversation from beats whose visual forms respond to tone and function. | 4–8 lines + speaker + sequence + function/tone tag. | Speech puzzle, two-person path, repairing ribbon. |

For the event demo, avoid starting with simulated physics, complex perspective geometry, audio-dependent play, or bespoke 3D. SVG, CSS transforms, and small pre-generated PNG layers are sufficient for these eight and will remain robust on ordinary phones and weaker connections.

### Phase 2: four templates for the mobile app

| Template ID | Permanent mechanic | Required database input | Built-in visual themes |
|---|---|---|---|
| `reveal_scene` | Move a reveal tool over fixed hotspots, then retrieve the discovered concepts. | Image + hotspot coordinates/masks + term per hotspot. | Lantern, clearing fog, rubbing parchment. |
| `balance_forces` | Add or adjust factors until a visual system reaches an approved stable state. | Factors + ranges/weights + target constraints. | Mobile, magnetic field, protecting a flame. |
| `choice_journey` | Choose at successive forks and see short- and long-term consequences. | Scenario graph with 2–4 nodes, choices, outcomes, and debrief. | River, road, doors in a landscape. |
| `reflective_orbits` | Arrange personal values/actions around a center and receive a non-scored reflection. | Items or user choices + optional recommended questions; no answer key required. | Orbits, compass rose, circles around a hearth. |

The themes are fixed assets and layout presets inside the component. A database field such as `"theme": "bridge"` selects one; it does not cause a new game to be designed.

## Recommended lesson rhythm

Do not make every game a scored quiz. A good reading section should draw from a pool with three different cognitive jobs:

1. **Recognise or retrieve** (20–40 seconds): Lantern, Fireflies, Lockbox, Stained Glass.
2. **Reconstruct structure** (45–90 seconds): Bridge, House, Tree, Constellation, Ripple.
3. **Reflect or apply** (60–120 seconds): River, Dialogue, Balance, Orbit, Magnetic Field.

The app can select one from each family. This creates variety without requiring thirty separate content-authoring workflows.

## A generator-friendly content contract

Every game can be generated from a small common object. The editor can fill this manually, or an AI draft can extract it from the reading and a human approves it.

```json
{
  "learningGoal": "structure | term | dynamic | reflection",
  "centralInsight": "Love matures when feeling becomes truthful choice and fidelity.",
  "image": {
    "asset": null,
    "prompt": "A sparse YOUCAT illustration of a young tree growing toward warm light"
  },
  "terms": [
    { "id": "feeling", "label": "Feeling", "role": "beginning" },
    { "id": "reality", "label": "Reality", "role": "discernment" },
    { "id": "decision", "label": "Decision", "role": "commitment" },
    { "id": "fidelity", "label": "Fidelity", "role": "fruit" }
  ],
  "relations": [
    ["feeling", "reality"],
    ["reality", "decision"],
    ["decision", "fidelity"]
  ],
  "reflectionPrompt": "Which ordinary action can make your love more reliable this week?"
}
```

The game adapter then converts the same approved content object into different representations. The sequence can become stepping stones, footprints, a tree, or a compass; the relation graph can become a constellation, metro, tapestry, or house. This is the important scalability advantage.

## Automatic-generation rules

- Keep most levels to **3–7 meaningful elements**. More items should become multiple short rounds.
- Use the approved reading to generate distractors that are plausible but clearly distinguishable after reflection; never invent controversial theological claims merely to create difficulty.
- Generate art before the event or app release and cache it. Do not make gameplay depend on live image generation.
- The illustration should carry atmosphere and spatial meaning; the answer data should remain deterministic and testable.
- Always reveal the complete structure and one short insight after play, including after a wrong attempt.
- Give immediate local feedback—stone tips, thread glows, branch withers—before showing explanatory text.
- Use failure gently. For pastoral reflection, prefer “try another arrangement” over red errors, lost hearts, or moralized shame.
- Reflective games such as Orbit and Magnetic Field should not claim that one personal arrangement is the only correct answer.

## Interaction and accessibility requirements

- Make each important target at least **44 × 44 points** on iOS ([Apple design guidance](https://developer.apple.com/design/tips/)).
- Any drag action must also work as **tap object, then tap destination**; WCAG 2.2 requires a single-pointer alternative to dragging ([W3C 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)).
- Never require precise path drawing, multitouch, device shaking, or a fast timer to understand the lesson.
- Provide a reduced-motion version that replaces moving scenery with fades or static state changes ([W3C reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)).
- Do not rely on color alone. Use shape, texture, position, and iconography as redundant cues.
- Sound and haptics should add delight but never carry essential information.
- Keep instructions to one short sentence and demonstrate the gesture once through animation.

## Product conclusion

The scalable product is not thirty unrelated games. It is **eight initial templates and four later templates** fed by one common content model:

1. place into meaningful zones;
2. order along a path;
3. connect a graph;
4. restore an image or object;
5. adjust a dynamic system;
6. reveal hidden meaning;
7. make consequential choices;
8. create a personal reflective arrangement.

With fixed built-in art themes, these templates can produce the full catalogue above. This keeps content production simple, makes theological review feasible, and gives the learner variety without creating a bespoke game for each question.
