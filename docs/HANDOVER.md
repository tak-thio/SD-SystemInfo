# SD-SystemInfo 開発引き継ぎ資料 (Handover Guide)

このドキュメントは、Stream Deck+ システムモニタープラグイン (`SD-SystemInfo`) の将来的なバージョンアップや、別セッション（AIチャット）での開発再開をスムーズに行うための引き継ぎ資料です。

## 1. プロジェクト概要

- **プラグイン名**: System Monitor (SD-SystemInfo)
- **ターゲット**: Stream Deck+ (ダイヤルとタッチスクリーン専用)
- **機能**: CPU使用率、RAM使用率（実質空き容量を含む）のリアルタイム表示。ダイヤル回転による3つの表示モード（同時・CPU単独・RAM単独）の切り替え。ダイヤル押し込み/タッチによるアクティビティモニターの起動。
- **現在のバージョン**: v1.0.0

## 2. 技術スタックとアーキテクチャ

- **SDK**: Elgato Stream Deck SDK (Node.js / TypeScript)
- **ビルドツール**: Rollup (`@rollup/plugin-typescript`, `@rollup/plugin-commonjs`, `@rollup/plugin-json`)
- **システム情報取得**:
  - CPU: Node.js 標準の `os.cpus()` を使用した差分計算。
  - RAM: サードパーティライブラリ `systeminformation` (`si.mem()`) を使用。macOSのキャッシュ領域を考慮した正確な実使用率と空き容量（`mem.available`）を計算。
- **UI**: Stream Deck+ のタッチスクリーン用カスタム JSON レイアウト。設定用の Property Inspector UI は通信エラーなどのバグを避けるため、静的な使い方の説明パネル(`system-monitor.html`)に変更済み。

## 3. ディレクトリ構成

```text
com.tak.system-monitor/
├── com.tak.system-monitor.sdPlugin/   # デプロイ・実行されるディレクトリ
│   ├── bin/                           # ビルド生成物 (plugin.js)
│   ├── layouts/                       # 表示モードごとの JSON レイアウト
│   │   ├── layout-combined.json
│   │   ├── layout-cpu.json
│   │   └── layout-ram.json
│   ├── manifest.json                  # プラグインのコア定義 (Action定義など)
│   └── ui/system-monitor.html         # Property Inspector (操作説明パネル)
├── docs/
│   ├── HANDOVER.md                    # 本資料
│   └── SKILL.md                       # Stream Deck開発におけるノウハウ・落とし穴集
├── src/                               # TypeScriptソースコード
│   ├── actions/system-monitor.ts      # コアロジック (SystemMonitorActionクラス)
│   └── plugin.ts                      # エントリーポイント
├── rollup.config.mjs                  # バンドル設定ファイル
└── package.json
```

## 4. 開発・ビルド手順

1. パッケージインストール: `npm install`
2. ビルド: `npm run build` (あるいは `npm run watch` で自動ビルド)
3. Stream Deckへの反映:
   - 初回: `streamdeck link com.tak.system-monitor.sdPlugin` を実行
   - 変更時: `streamdeck restart com.tak.system-monitor` でプラグインを再起動

## 5. ⚠️ 開発時の重大な注意点 (ハマりどころ)

v1.0.0 の開発において、以下のStream Deck特有の仕様によるクラッシュが発生しました。今後の開発でも必ず留意してください。
**(※さらに詳細なノウハウが `docs/SKILL.md` にまとまっています。次回開発時はまず `docs/SKILL.md` を一読してください)**

1. **`manifest.json` の `States` 配列は必須**
   - ダイヤル専用のアクションであっても、`manifest.json` の `Actions` 内に `States` 配列が最低1つ定義されていないと、プラグインがアクションリストから除外されます。
2. **タッチスクリーンレイアウト (`layouts/*.json`) の1pxの重なりも許されない**
   - JSONレイアウト内の各要素 (`text`, `bar`, `pixmap` など) の `rect` 属性 (X, Y, Width, Height) が **1ピクセルでも重なると (Overlap)、描画エンジンがクラッシュし、表示が完全に壊れます。**
   - 座標計算は厳密に行う必要があります。
3. **JSONレイアウト内の `text` の値は `"value"` キーを使用する**
   - 文字列を指定する際のプロパティは `"text"` ではなく `"value"` です。間違えると `nonsense value` エラーでクラッシュします。
4. **外部コマンド実行時の PATH 制限**
   - Stream Deckからプラグインが起動される際、環境変数 `PATH` が制限されています。`exec("vm_stat")` のようにコマンド名だけで実行すると失敗（エラー）するため、必ず **`/usr/bin/vm_stat` のように絶対パスで指定** してください。
5. **`os.freemem()` を使わない (macOSのメモリ仕様)**
   - UIに表示するRAM使用率は、`systeminformation` パッケージを使用して `mem.total - mem.available` で計算してください。

## 6. 今後の展望 (v1.1.0 以降のアイデア)

- GPU使用率の表示追加 (`macmon` 等を用いた Apple Silicon への対応調査)。
- 好みに応じて色などを変更できるカスタマイズ設定の導入。
- Elgato Marketplace への公式リリースに向けたパッケージ化、英語説明文・ストアアセットの準備。
