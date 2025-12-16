# kippo-ui

A modern React application with React Router

## 🚀 クイックスタート

### 前提条件

- Node.js 18.0以上
- パッケージマネージャーpnpm

### セットアップ

```bash
# 依存関係をインストール
pnpm install
```

### Playwright のセットアップ

初回実行時は、Playwrightブラウザのインストールが必要です：

```bash
pnpm pre_install
```

### 開発サーバーの起動

```bash
pnpm dev
```

## 📁 プロジェクト構造

```
kippo-ui/
├── app/                    # アプリケーションソースコード
│   ├── lib/              # 共有ライブラリ
│   ├── routes/           # ルートコンポーネント
│   ├── app.css           # グローバルスタイル
│   ├── root.tsx          # ルートコンポーネント
│   └── routes.ts         # ルート設定
├── public/                # 静的ファイル
├── tests/                 # テストファイル
│   ├── sample.unit.test.ts        # ユニットテスト例
│   └── welcome.browser.test.tsx   # ブラウザテスト
├── biome.json            # Biome設定
├── orval.config.cjs      # Orval API設定
├── package.json          # npm設定
├── pnpm-workspace.yaml   # pnpmワークスペース設定
├── tsconfig.json         # TypeScript設定
├── vite.config.ts        # Vite設定
└── vitest.config.ts      # Vitest設定
```

## 📜 利用可能なスクリプト

| コマンド                       | 説明                    |
|----------------------------|-----------------------|
| `pnpm pre_install`         | Playwrightブラウザのインストール |
| `pnpm generate_api_client` | API Clientの生成         |
| `pnpm dev`                 | 開発サーバーを起動（HMR有効）      |
| `pnpm build`               | 本番用ビルドを作成             |
| `pnpm start`               | ビルドしたサーバーを起動          |
| `pnpm lint`                | oxlintでコードをチェック       |
| `pnpm lint:strict`         | 警告もエラーとして扱うlint       |
| `pnpm format`              | Biomeでコードをフォーマット      |
| `pnpm format:check`        | フォーマットのチェックのみ         |
| `pnpm typecheck`           | TypeScriptの型チェック      |
| `pnpm test`                | テストを実行                |
| `pnpm test:cov`            | カバレッジレポート付きでテストを実行    |
| `pnpm check`               | 型チェック、テスト、フォーマットを一括実行 |

## 🛠️ 技術スタック

### フレームワーク & ライブラリ
- **React 19.2** - UIライブラリ
- **React Router 7.9** - ルーティング
- **TypeScript 5.9** - 型安全な開発
- **Vite 6.3** - 高速ビルドツール
- **Tailwind CSS 4.1** - CSSフレームワーク

### テストツール
- **Vitest 3.2** - Viteベースのテストランナー
- **@vitest/browser** - ブラウザ環境でのテスト実行
- **Playwright 1.56** - ブラウザ自動化

### 開発ツール
- **Biome** - コードフォーマッター
- **Oxlint** - 高速リンター
- **pnpm** - パッケージマネージャー

## 🔌 API Client Generation

### Overview

This project uses **orval** to generate TypeScript API clients from the OpenAPI specification located at `docs/openapi.yaml`.

### Generating the API Client

```bash
pnpm generate_api_client
```

This command:
1. Reads the OpenAPI spec from `docs/openapi.yaml`
2. Generates TypeScript functions and types in `app/lib/api/generated/`
3. Uses the custom fetch wrapper in `app/lib/api/custom-fetch.ts` for authentication and base URL handling

### Generated Client Structure

```
app/lib/api/generated/
├── index.ts              # Unified exports (use this for imports)
├── models/               # TypeScript type definitions
│   └── index.ts          # All model exports
├── projects/             # Project-related API endpoints (/api/projects/)
├── requirements/         # Requirements API endpoints (/api/requirements/...)
└── token/                # Authentication endpoints (/api/token/)
```

### Usage in Components

Import functions and types from the unified index:

```typescript
import {
  projectsList,
  assumptionsCreate,
  businessRequirementsList,
  type RequirementsProjectList,
  type ProjectAssumption,
} from "~/lib/api/generated";
```

### API Function Naming Convention

Requirements-related functions use the `requirements` prefix and call `/api/requirements/...` endpoints:
- `requirementsAssumptionsList` → `GET /api/requirements/assumptions/`
- `requirementsBusinessRequirementsList` → `GET /api/requirements/business-requirements/`

For convenience, aliases without the prefix are also exported:
- `assumptionsList` (alias for `requirementsAssumptionsList`)
- `businessRequirementsList` (alias for `requirementsBusinessRequirementsList`)

### Updating the OpenAPI Spec

1. Update `docs/openapi.yaml` with the new API definition
2. Run `pnpm generate_api_client` to regenerate the client
3. Update any affected components to use new functions/types

### Notes

- The API client uses JWT authentication via the `Authorization: Bearer` header
- Base URL is configurable via `VITE_BASE_URL` environment variable (defaults to `http://localhost:8000`)
- Auth tokens are stored in `localStorage` under `authToken`

## ⚙️ 設定

### Vitestの設定

`vitest.config.ts`では、ユニットテストとブラウザテストの2つのプロジェクトを設定：

```typescript
// ユニットテスト: Node環境で実行
{
  test: {
    include: ["tests/**/*.unit.{test,spec}.{ts,tsx}"],
    name: "unit",
    environment: "node",
  }
}

// ブラウザテスト: Playwrightで実行
{
  test: {
    include: ["tests/**/*.browser.{test,spec}.{ts,tsx}"],
    name: "browser",
    browser: {
      headless: true,
      enabled: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
    }
  }
}
```

## 🧪 テスト

このプロジェクトではVitestを使用して、ユニットテストとブラウザテストの両方をサポートしています。

### テスト構成

Vitestは2つのプロジェクトで構成されています：

1. **ユニットテスト** - Node.js環境で実行
2. **ブラウザテスト** - Playwrightを使用した実際のブラウザ環境で実行

### テストの実行

```bash
# 全てのテストを実行
pnpm test

# カバレッジレポート付きでテストを実行
pnpm test:cov

# ウォッチモードでテストを実行
pnpm vitest

# 特定のプロジェクトのみ実行
pnpm vitest --project=unit     # ユニットテストのみ
pnpm vitest --project=browser  # ブラウザテストのみ
```

### テストファイルの配置

- `tests/*.unit.test.{ts,tsx}` - ユニットテスト（Node環境）
- `tests/*.browser.test.{ts,tsx}` - ブラウザテスト（Playwright）

### ブラウザテストについて

ブラウザテストは実際のブラウザ環境でコンポーネントをテストします：

- **Playwright**を使用してChromiumブラウザで実行
- React DOMのレンダリングとインタラクションをテスト
- ダークモードやレスポンシブデザインのテストも可能

#### 例：Welcomeコンポーネントのブラウザテスト

`tests/welcome.browser.test.tsx`では以下をテスト：
- コンポーネントの正しいレンダリング
- ライト/ダークモードのロゴ切替
- リンクとSVGアイコンの表示
- CSSクラスの適用
- ホバー効果の動作

## 🚀 デプロイメント

### 本番ビルド

```bash
npm run build
```

ビルド成果物は `build/` ディレクトリに出力されます。


## 🔧 トラブルシューティング

### プロジェクト情報

- **作成者**: goya813 (your.email@example.com)
- **GitHub**: https://github.com/goya813/test-react-app
- **バージョン**: 0.1.0

### よくある問題

**ポートの競合**
```bash
# 別のポートで起動
pnpm dev -- --port 3000
```

**依存関係のエラー**
```bash
# node_modulesをクリーンアップ
rm -rf node_modules pnpm-lock.json
pnpm install
```

**TypeScriptエラー**
```bash
# 型チェックを実行
pnpm typecheck
```

**ビルドエラー**
```bash
# キャッシュをクリア
rm -rf build
pnpm run build
```

**テストエラー**
```bash
# スクリーンショットを確認
ls tests/__screenshots__/
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
