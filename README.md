# Phrz4g

## Overview
Phrz4g is a **personal English learning web app**. You can register your own lesson materials (English script / Japanese translation / audio), practice with dictation and shadowing, and track study time and attempt counts.

## Authentication
This app uses **Google Sign-In with Firebase Authentication**.

- Authentication state is managed by Firebase Auth (`onAuthStateChanged`)
- The app uses authenticated `user.uid` as `userId`
- Unauthenticated users are redirected to `/login`
- Login is available only through Google Sign-In

## Tech Stack
- React + Vite
- Firebase Authentication (Google provider)
- Firebase Hosting
- Cloud Firestore (lessons / study logs)
- Firebase Storage (audio files)
- GitHub Actions (auto deploy on push/merge to `main`)

## Required Firebase Setup
- Firebase project: `phrz4g`
- Create a Web App
- Enable Firebase Authentication (Google provider)
- Enable Cloud Firestore
- Enable Firebase Storage
- Hosting site: `phrz4g`

## Environment Variables (Local Development)
Firebase Web App config values are defined directly in `src/lib/firebase.js` because they are intended to be public in the browser.

1. Copy `.env.example` to `.env` (optional; currently no required Vite env vars)

```bash
cp .env.example .env
```

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

#### Firebase Hosting Auth
- `FIREBASE_SERVICE_ACCOUNT_PHRZ4G`

### What the Workflow Does
1. `npm install`
2. `npm run build`
3. Writes the service account JSON to a temp file and deploys to Firebase Hosting `live`

## Supported Audio Format (MVP)
- Currently, only **MP3** files are supported for lesson audio upload.
- `m4a` files (for example from Apple Voice Memos) are not accepted as-is. Please convert them to MP3 first.

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

## Localユーザーデータ移行（Admin SDK）

`userId: "local"` のFirestore/Storageデータを実UIDへ安全にコピー/更新するための管理スクリプトを追加しています。

- Dry-run: `npm run migrate:local -- --uid=<TARGET_UID> --dry-run`
- 本実行: `npm run migrate:local -- --uid=<TARGET_UID>`

認証情報は以下のいずれかで読み込みます（フロントエンドのAPIキーは不使用）。

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_SERVICE_ACCOUNT_BASE64` または `FIREBASE_SERVICE_ACCOUNT_PHRZ4G`
- `GOOGLE_APPLICATION_CREDENTIALS` または `FIREBASE_SERVICE_ACCOUNT_PATH`

必要に応じて `FIREBASE_STORAGE_BUCKET` も指定してください。
