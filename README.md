# Phrz4g

## プロジェクト概要
Phrz4g は、**個人利用向け**の英語学習 Web アプリです。自分で登録した教材（英文/和訳/音声）を使い、ディクテーションとシャドーイングを行い、学習時間や回数を記録します。

## 現在の認証方式（MVP確認優先の暫定構成）
Firebase Authentication は一時的に無効化し、**アプリ内パスコード認証**で動作確認する構成です。

- ログイン画面で `VITE_APP_PASSCODE` と一致するパスコードを入力すると認証成功
- 認証状態は `localStorage` の `phrz4g_authenticated=true` で保持
- ログアウト時は認証フラグを削除
- 未認証時は `/login` にリダイレクト
- データ上の `userId` は固定値 `local` を使用
- Storage 保存先は `users/local/lesson-audio/{filename}`

> 本番運用前には Firebase Auth を復旧し、Firestore / Storage Rules をログインユーザー限定（`request.auth.uid` ベース）に戻してください。

## 使用技術
- React + Vite
- Firebase Hosting（配信）
- Cloud Firestore（教材・学習ログ保存）
- Firebase Storage（音声ファイル保存）
- GitHub Actions（main push/merge 時の自動デプロイ）

## Firebase で必要な設定
- Firebase プロジェクト: `phrz4g`
- Web App 作成
- Cloud Firestore 有効化
- Firebase Storage 有効化
- Hosting site: `phrz4g`

## 環境変数の設定（ローカル開発時）
Firebase Web App config はブラウザに公開される前提の値のため、`src/lib/firebase.js` に固定値を定義しています。

1. `.env.example` をコピーして `.env` を作成
2. `VITE_APP_PASSCODE` に任意のパスコードを設定

```bash
cp .env.example .env
```

`.env.example` キー:
- `VITE_APP_PASSCODE`

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
- `VITE_APP_PASSCODE`

#### Firebase Hosting デプロイ認証用
- `FIREBASE_SERVICE_ACCOUNT_PHRZ4G`

### Workflow 内で実行される処理
1. `npm install`
2. Secrets から `VITE_APP_PASSCODE` のみ `.env` を生成
3. `npm run build`
4. サービスアカウントJSONを一時ファイルに出力して Firebase Hosting へ `live` デプロイ

## データ保存方針（暫定）
- Firestore: `lessons`, `studyLogs`, `dictationAttempts` の各ドキュメントに `userId: "local"` を保存
- Storage: `users/local/lesson-audio/{filename}`

## 本番運用前の復旧チェック
1. Firebase Authentication を復旧（Google / Email Provider を必要に応じて有効化）
2. クライアント実装を Firebase Auth ベースに戻す（uid ごとの分離）
3. Firestore Rules を `request.auth.uid` 制約に戻す
4. Storage Rules を `request.auth.uid` 制約に戻す
5. テストユーザー以外でアクセス分離を確認

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
