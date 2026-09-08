# α生態戦プロトタイプ

3x3 auto tactics prototype. The playable static build lives in `prototype/`.

## 最新版と検証

[iPhone / PCで試す](https://mcotto033.github.io/game_development/)。2026-09-08公開対象はM1完了時点のプロトタイプです。[試遊レビュー資料](docs/autodev-m1-review.md) と [ロードマップ](docs/ROADMAP.md) に実装範囲・検証結果・残件をまとめています。

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

このリポジトリは `.github/workflows/deploy-pages.yml` で `prototype/` をGitHub Pagesへデプロイします。

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
