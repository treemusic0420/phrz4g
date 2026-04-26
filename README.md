# Phrz4g

## プロジェクト概要
Phrz4g は、**個人利用向け**の英語学習 Web アプリです。自分で登録した教材（英文/和訳/音声）を使い、ディクテーションとシャドーイングを行い、学習時間や回数を記録します。

## 使用技術
- React + Vite
- Firebase Hosting（配信）
- Firebase Authentication（Googleログイン）
- Cloud Firestore（教材・学習ログ保存）
- Firebase Storage（音声ファイル保存）
- GitHub Actions（main push/merge 時の自動デプロイ）

## Firebase で必要な設定
- Firebase プロジェクト: `phrz4g`
- Web App 作成
- Authentication: Google Provider 有効化
- Cloud Firestore 有効化
- Firebase Storage 有効化
- Hosting site: `phrz4g`

## Firebase config を `.env` に設定する方法（ローカル開発時）
1. `.env.example` をコピーして `.env` を作成
2. Firebase Console の Web App 設定値を入力
3. 個人利用の許可メールを `VITE_ALLOWED_EMAIL` に設定

```bash
cp .env.example .env
```

`.env.example` キー:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID=phrz4g`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ALLOWED_EMAIL`

> `.env` は機密情報を含むためコミットしません（`.gitignore` 済み）。

## ローカル起動手順
```bash
npm install
npm run dev
```

## ビルド手順
```bash
npm run build
```

## Firebase Hosting へのデプロイ手順（GitHub Actions 自動デプロイ）
`main` ブランチへの push / merge で、GitHub Actions が自動実行され、Firebase Hosting の `live` チャンネルへデプロイされます。

Workflow: `.github/workflows/deploy-hosting.yml`

### GitHub Secrets に必要な値
以下を **Repository Secrets** に設定してください。

#### フロントエンドビルド用（Vite）
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ALLOWED_EMAIL`

#### Firebase Hosting デプロイ認証用
- `FIREBASE_SERVICE_ACCOUNT_PHRZ4G`
  - Firebase 推奨の GitHub Actions 連携で発行したサービスアカウントJSONを登録

### Workflow 内で実行される処理
1. `npm install`
2. Secrets から `.env` を生成
3. `npm run build`
4. `FirebaseExtended/action-hosting-deploy` で `live` へデプロイ

## Firestore / Storage / Authentication を使う前提
- Authentication: ログイン後、`VITE_ALLOWED_EMAIL` と一致するメールのみ利用可（不一致はログアウト）
- Storage: 音声は `users/{userId}/lesson-audio/{filename}` に保存
- Firestore: `lessons`, `studyLogs`, `dictationAttempts` の各ドキュメントに `userId` を保存

## Storage Rules サンプル
```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/lesson-audio/{fileName} {
      allow read: if request.auth != null
                  && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 20 * 1024 * 1024
                   && request.resource.contentType.matches('audio/.*');
    }
  }
}
```

## Firestore Rules サンプル
```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lessons/{lessonId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.userId;
    }
    match /studyLogs/{logId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.userId;
    }
    match /dictationAttempts/{attemptId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## 今回スコープ外の機能
- AI添削
- AI音声生成
- LINE通知
- プッシュ通知
- Cloud Functions
- Cloud Scheduler
- 録音機能
- 発音採点
- 音声波形表示
- 課金機能
- 多人数対応
- 教材販売
- 管理者/一般ユーザー権限
- ランキング
- バッジ
- ネイティブアプリ化
