# YOUCAT Learning Platform — event demo

Mobile-first, Brazilian Portuguese demo for a 200-person event. The app contains all ten selected YOUCAT Love Forever questions, authenticated answers and Deep Dives, 40 games, ten quizzes, anonymous personal reflections, persistent XP, achievements, and live individual/group leaderboards.

## Architecture

- GitHub Pages serves the static Vite app.
- Cloud Firestore stores group mission reservations, reflections, hearts, and live scores.
- Firebase Anonymous Authentication gives each browser one persistent participant ID.
- The browser keeps the participant profile, group, reading progress, attempts, achievements, and XP until the participant explicitly starts again or clears browser data.
- Reading XP uses a 400-words-per-minute timer and requires at least 85% scroll progress on long texts.
- The home screen randomly assigns the next available mission. Question cards show only each group’s progress through the five shared challenges and cannot be opened directly.
- Every mission contains all reading pages. Reading XP can be earned only once per text.
- Each question has five shared challenges: four games and one quiz. A Firestore transaction reserves each challenge for one group member for five minutes. Right or wrong, the first attempt permanently completes it for that group; a wrong answer awards 0 XP.
- Every participant receives one optional personal-reflection mission per question. Reflection XP scales from 3 to 10 XP for answers up to 300 characters.
- Reflection boards unlock permanently at 90% participation, with at least four active participants. Each participant can give up to three anonymous hearts per question.
- Group changes transfer all of the participant’s XP to the new group and release any unfinished mission.
- Firestore stores compact leaderboard records and 20 group summaries. Leaderboard synchronization is delayed and batched to protect the Spark-plan allowance.
- Reflections remain visible indefinitely. The demo does not automatically delete Firestore documents.
- If Firebase variables are absent, the app runs as a safe local preview.

The shared challenge state is organized into 20 small-group rooms of roughly ten participants. Reflection boards are global and anonymous, and are opened only when assigned near the end of each question’s participation cycle.

## Local preview

1. Install Node.js 22.
2. Run `npm ci`.
3. Run `npm run doctor` to verify the local toolchain, authenticated source paths, and Firebase setup.
4. Run `npm run dev`.
5. Open the local URL shown in the terminal.

The doctor never prints Firebase values. Missing Firebase configuration is only a warning because the app has a safe local-preview mode. Publication-source warnings matter only when regenerating authenticated content.

Use `?lang=en` for the development-language version. Use a predefined group code such as `?room=Assis-Sao-Jose` to preselect a group from a QR code; participants can still change groups later.

## Minigame foundation

The shared Phaser 3.90 runtime is lazy-loaded only after Home. Production startup remains on the existing HTML path, while bundled fixtures and engines can be reviewed in the isolated Game Lab. Open C21 “Balance of Love” with `?lab=C21&lang=en` or `?lab=C21&lang=pt`; the non-production foundation proof remains available at `?lab=foundation-skeleton-v1&lang=en`. C21 replaces Q127 game 1 (mission slot 0) while preserving four games and one quiz.

See [`docs/minigame-foundation.md`](docs/minigame-foundation.md) for the exact `GameInstance` and engine contracts, integration boundaries, and engine-worktree instructions. Use [`docs/minigame-ui-ux-review-checklist.md`](docs/minigame-ui-ux-review-checklist.md) for objective review before enabling an engine in missions.

## 200-user load test

The reproducible emulator test models 200 participants in the 20 predefined groups. Each participant synchronizes XP, opens five questions, publishes five reflections, gives ten hearts, and has at most one reflection feed open at a time. It also verifies all current-group leaderboards and the 20 live group summaries. It uses local Firebase emulators, so it creates no production data and incurs no Firebase usage.

Requirements: Node.js 22, Java 21, and an internet connection for the first Firebase CLI/emulator download.

```sh
npx --yes firebase-tools@15.23.0 emulators:exec \
  --only auth,firestore \
  --project demo-youcat-loadtest \
  'LOAD_USERS=200 LOAD_ROOM_SIZE=10 LOAD_TIMEOUT_MS=120000 node scripts/load-test.mjs'
```

See [`docs/load-test-report-2026-07-13.md`](docs/load-test-report-2026-07-13.md) for the verified event scenario and results.

## Firebase setup

1. Create or select a dedicated Firebase project.
2. Add a Web app in **Project settings** and copy its configuration values.
3. Enable **Authentication → Sign-in method → Anonymous**.
4. Create a **Cloud Firestore** database in the region closest to the event.
5. Copy `.env.example` to `.env.local` and add the six Web app values.
6. Associate the Firebase CLI with the project and deploy `firestore.rules` and `firestore.indexes.json`: `npx firebase-tools deploy --only firestore:rules,firestore:indexes`.
7. Keep the project on the no-cost Spark plan. Reflections remain stored until you manually delete them or the dedicated project.

Before the event, request a temporary increase to Firebase Authentication’s new-account creation limit. The standard limit is 100 new accounts per IP address per hour, and a venue Wi-Fi network can make many phones appear under one public IP. See [Firebase Authentication limits](https://firebase.google.com/docs/auth/limits).

## GitHub Pages deployment

The workflow in `.github/workflows/pages.yml` runs checks, builds the site, and deploys it on every push to `main`.

In the GitHub repository:

1. Set **Settings → Pages → Source** to **GitHub Actions**.
2. Add these **Actions variables** under **Settings → Secrets and variables → Actions**:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Push `main` or run the workflow manually.

Firebase Web app configuration values are public identifiers, not server secrets. Firestore access is protected by Authentication and `firestore.rules`.

## Event checklist

- Assign one of the 20 predefined Assis saint groups to each table.
- Generate one QR code per room using the Pages URL plus `?room=ROOM-CODE`.
- Ask 10–15 test users to join simultaneously on the venue Wi-Fi.
- Verify that two members of the same group never receive the same shared challenge.
- Verify that all reading pages appear in every assigned mission.
- Verify that question progress advances after a shared challenge is submitted, including a wrong answer.
- Verify that a participant cannot heart their own answer or heart the same answer twice.
- Check Firebase Authentication and Firestore usage during the rehearsal.
- Schedule the temporary Authentication quota increase for the event window.
- Keep the Firebase project for this event only; delete it manually if the stored reflections are no longer needed.

## Content source

Official questions and answers are generated from the authenticated local file `YOUCAT_loveforever_QA_PT.md` (with English available for development). Run `npm run content` only when those source files change. `npm run check` verifies that all ten selected questions and their learning activities are present.
