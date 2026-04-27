# Phrz4g

## Overview
Phrz4g is a **personal English learning web app**. You can register your own lesson materials (English script / Japanese translation / audio), practice with dictation and shadowing, and track study time and attempt counts.

## Current Authentication (Temporary MVP Setup)
Firebase Authentication is temporarily disabled. The app currently uses **in-app passcode authentication** for MVP verification.

- Login succeeds when the entered passcode matches `VITE_APP_PASSCODE`
- Auth state is stored in `localStorage` as `phrz4g_authenticated=true`
- Logout clears the auth flag
- Unauthenticated users are redirected to `/login`
- `userId` is fixed to `local`
- Audio files are stored under `users/local/lesson-audio/{filename}`

> Before production release, restore Firebase Auth and switch Firestore / Storage Rules back to authenticated-user restrictions (`request.auth.uid` based).

## Tech Stack
- React + Vite
- Firebase Hosting
- Cloud Firestore (lessons / study logs)
- Firebase Storage (audio files)
- GitHub Actions (auto deploy on push/merge to `main`)

## Required Firebase Setup
- Firebase project: `phrz4g`
- Create a Web App
- Enable Cloud Firestore
- Enable Firebase Storage
- Hosting site: `phrz4g`

## Environment Variables (Local Development)
Firebase Web App config values are defined directly in `src/lib/firebase.js` because they are intended to be public in the browser.

1. Copy `.env.example` to `.env`
2. Set your passcode in `VITE_APP_PASSCODE`

```bash
cp .env.example .env
```

`.env.example` key:
- `VITE_APP_PASSCODE`

> `.env` is ignored by git and should not be committed.

## Run Locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy to Firebase Hosting (GitHub Actions)
On push/merge to `main`, GitHub Actions runs automatically and deploys to the Firebase Hosting `live` channel.

Workflow: `.github/workflows/deploy-hosting.yml`

### Required GitHub Secrets
Set the following in **Repository Secrets**.

#### Frontend Build (Vite)
- `VITE_APP_PASSCODE`

#### Firebase Hosting Auth
- `FIREBASE_SERVICE_ACCOUNT_PHRZ4G`

### What the Workflow Does
1. `npm install`
2. Generates `.env` using only `VITE_APP_PASSCODE`
3. `npm run build`
4. Writes the service account JSON to a temp file and deploys to Firebase Hosting `live`

## Data Storage Policy (Temporary)
- Firestore: stores `userId: "local"` in `lessons`, `studyLogs`, and `dictationAttempts`
- Storage: `users/local/lesson-audio/{filename}`

## Supported Audio Format (MVP)
- Currently, only **MP3** files are supported for lesson audio upload.
- `m4a` files (for example from Apple Voice Memos) are not accepted as-is. Please convert them to MP3 first.

## Pre-Production Restoration Checklist
1. Restore Firebase Authentication (enable Google / Email providers as needed)
2. Switch client implementation back to Firebase Auth-based user isolation by uid
3. Restore Firestore Rules using `request.auth.uid`
4. Restore Storage Rules using `request.auth.uid`
5. Verify data isolation with non-test users

## Out of Scope in This Version
- AI corrections
- AI voice generation
- LINE notifications
- Push notifications
- Cloud Functions
- Cloud Scheduler
- Audio recording
- Pronunciation scoring
- Audio waveform display
- Payments
- Multi-user support
- Lesson marketplace
- Admin/user role separation
- Rankings
- Badges
- Native app packaging

## About Existing Data After Category ID Migration
- Lessons now use `categoryId` (documentId in `categories`) instead of category text values.
- Legacy lesson format (`category` / `categoryName` / `categorySlug`) is not supported for backward compatibility.
- Delete old lesson data in Firestore Console or re-register lessons.
- The app does not include automatic full deletion of old lessons.
- Since the monthly archive fields (`registeredMonth` / `registeredMonthLabel`) were introduced, deleting or re-registering old lessons is recommended.
