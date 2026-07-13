# YOUCAT Learning Platform — event demo

Mobile-first, Brazilian Portuguese demo for a 200-person event. The app contains all ten selected YOUCAT Love Forever questions, the authenticated answers, two Deep Dives per question, three games, three quiz cards, a written reflection, and a ranked small-group reflection feed.

## Architecture

- GitHub Pages serves the static Vite app.
- Cloud Firestore stores group reflections and hearts.
- Firebase Anonymous Authentication gives each open browser session one participant ID.
- No profile, progress, or game state is persisted after the page is renewed.
- Reflections remain visible indefinitely. The demo does not automatically delete Firestore documents.
- If Firebase variables are absent, the app runs as a safe local preview.

The live feed is intentionally organized into small-group rooms. For 200 participants, use about 20 room codes with roughly 10 people each. Do not put all 200 participants in one room: every answer would be delivered to every open listener and would consume the daily Firestore read allowance quickly.

## Local preview

1. Install Node.js 22.
2. Run `npm ci`.
3. Run `npm run dev`.
4. Open the local URL shown in the terminal.

Use `?lang=en` for the development-language version. Use `?room=MESA-04` to prefill and lock a room code, which is useful for QR codes.

## 200-user load test

The reproducible emulator test models 200 participants in 20 rooms. Each participant opens five questions, publishes five reflections, gives ten hearts, and has at most one live feed open at a time. It uses the local Firebase Authentication and Firestore emulators, so it creates no production data and incurs no Firebase usage.

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
6. Associate the Firebase CLI with the project and deploy `firestore.rules` and `firestore.indexes.json`.
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

- Prepare one short room code per table or small group.
- Generate one QR code per room using the Pages URL plus `?room=ROOM-CODE`.
- Ask 10–15 test users to join simultaneously on the venue Wi-Fi.
- Verify that answers appear only inside the correct room and question.
- Verify that a participant cannot heart their own answer or heart the same answer twice.
- Check Firebase Authentication and Firestore usage during the rehearsal.
- Schedule the temporary Authentication quota increase for the event window.
- Keep the Firebase project for this event only; delete it manually if the stored reflections are no longer needed.

## Content source

Official questions and answers are generated from the authenticated local file `YOUCAT_loveforever_QA_PT.md` (with English available for development). Run `npm run content` only when those source files change. `npm run check` verifies that all ten selected questions and their learning activities are present.
