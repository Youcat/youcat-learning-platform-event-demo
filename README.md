# YOUCAT Learning Platform — event demo

Mobile-first, Brazilian Portuguese demo for a 200-person event. The app contains all ten selected YOUCAT Love Forever questions, the authenticated answers, two Deep Dives per question, three games, three quiz cards, a written reflection, and a ranked small-group reflection feed.

## Architecture

- GitHub Pages serves the static Vite app.
- Cloud Firestore is used only for six-hour group reflections and hearts.
- Firebase Anonymous Authentication gives each open browser session one participant ID.
- No profile, progress, or game state is persisted after the page is renewed.
- Expired answers are hidden by the client immediately; Firestore TTL removes them later.
- If Firebase variables are absent, the app runs as a safe local preview.

The live feed is intentionally organized into small-group rooms. For 200 participants, use about 20 room codes with roughly 10 people each. Do not put all 200 participants in one room: every answer would be delivered to every open listener and would consume the daily Firestore read allowance quickly.

## Local preview

1. Install Node.js 22.
2. Run `npm ci`.
3. Run `npm run dev`.
4. Open the local URL shown in the terminal.

Use `?lang=en` for the development-language version. Use `?room=MESA-04` to prefill and lock a room code, which is useful for QR codes.

## Firebase setup

1. Create or select a dedicated Firebase project.
2. Add a Web app in **Project settings** and copy its configuration values.
3. Enable **Authentication → Sign-in method → Anonymous**.
4. Create a **Cloud Firestore** database in the region closest to the event.
5. Copy `.env.example` to `.env.local` and add the six Web app values.
6. Associate the Firebase CLI with the project and deploy `firestore.rules` and `firestore.indexes.json`.
7. Confirm the TTL policy is active for the collection group `reflections`, field `expiresAt`.

TTL deletion requires a billing-enabled Firebase project. The app still hides expired answers without TTL, but the stored documents will not be deleted automatically.

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
- Keep the Firebase project for this event only; delete it after the retention window if no further demo is planned.

## Content source

Official questions and answers are generated from the authenticated local file `YOUCAT_loveforever_QA_PT.md` (with English available for development). Run `npm run content` only when those source files change. `npm run check` verifies that all ten selected questions and their learning activities are present.
