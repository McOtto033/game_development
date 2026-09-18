# α生態戦プロトタイプ

3x3 auto tactics prototype. The playable static build lives in `prototype/`.

## 最新版と検証

[カード設計室をiPhone / PCで開く](https://mcotto033.github.io/game_development/card-studio/)。新カードの定型入力、効果種類の追加、設計メモ・調整履歴の保存に対応しています。公開版は端末ごとのブラウザ内に保存し、PCとの受け渡しにはJSONの書き出し・取り込みを使います。[使い方](development/card-studio/README.md)。

[iPhone / PCで試す](https://mcotto033.github.io/game_development/)。2026-09-08公開対象はM1完了時点のプロトタイプです。[試遊レビュー資料](docs/autodev-m1-review.md) と [ロードマップ](docs/ROADMAP.md) に実装範囲・検証結果・残件をまとめています。

比較版C1は `prototype-comparison/index.html` から起動できます。A旧表示/Bビジュアル表示、形別の数値ポップ、編成編集を備え、現行版とは保存先を分離しています。[比較試遊資料](docs/ui-comparison-c1.md) を参照してください。次回のPagesデプロイ後は [比較版をスマホで試す](https://mcotto033.github.io/game_development/prototype-comparison/) から開けます。

個人の利用枠・端末情報・タスクIDを含む自動開発の運用記録はローカルに保持し、この公開リポジトリには含めません。ローカル作業の規約は `AGENTS.md` を参照します。

Node.js 22以上で、次の1コマンドから本体と研究シナリオを検証できます。追加パッケージやビルドは不要です。

```powershell
.\scripts\verify.ps1
```

他の環境では `node scripts/verify.js`。UIの見た目やリプレイの時間進行は別途ブラウザで確認します。変更前の復元用コピーは `node scripts/create-checkpoint.js` で `.autodev/checkpoints/` に作成します。

本体の標準総当たりJSONは `node scripts/report-standard-battles.js`。保存方法と指標の定義は [非ゲーム化の観測指標](docs/non-game-metrics-v1.md) を参照します。

## iPhoneでローカル確認

PCとiPhoneを同じWi-Fiに接続してから、PC側で次を実行します。

```powershell
.\scripts\start-iphone-preview.ps1
```

表示された `http://<PCのIPv4>:8000/` をiPhoneのSafariで開きます。Windows Firewallが出た場合は、プライベートネットワークを許可します。

## GitHub Pagesで確認

このリポジトリは `.github/workflows/deploy-pages.yml` でプレイ用ファイルだけをGitHub Pagesへデプロイします。

- サイト直下: これまでどおりの現行版。内容とURLは変更しません。
- `prototype-comparison/`: 独立した比較版C1。
- `prototype/`: 比較版内の「現行版」リンク用に、同じ現行版を配置します。ローカルHTMLと公開版で相対リンクを共通に保つためのコピーです。

リポジトリ全体やローカルの作業記録はPagesへ配置しません。PCのローカルHTMLとスマホの公開URLではブラウザ保存データを共有しません。

1. GitHubリポジトリを作成し、このローカルリポジトリに `origin` を設定します。
2. `master` または `main` にpushします。
3. GitHubの `Settings > Pages` で `Source` を `GitHub Actions` にします。
4. `Actions` の `Deploy prototype to GitHub Pages` が完了したら、表示されたPages URLをiPhoneで開きます。

初回pushの例:

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
git add prototype .github/workflows/deploy-pages.yml
git commit -m "Add game prototype and Pages deployment"
git push -u origin master
```

## リモート開発ループ

iPhoneではPages URLまたはローカル確認URLで実機操作します。修正したい点が出たら、このデスクトップ上のCodexタスクへ指示します。Codexがこの作業ツリーを編集し、push後にGitHub Pagesが自動更新されます。
