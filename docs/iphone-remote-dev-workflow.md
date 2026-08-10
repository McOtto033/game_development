# iPhone実機確認とGitHub Pages運用

## 目的

iPhoneでは操作確認に集中し、コード編集やGit操作はデスクトップ側のCodexに指示して進める。

## 近距離確認

同じWi-Fiにいるときは、PCで次を起動する。

```powershell
.\scripts\start-iphone-preview.ps1
```

スクリプトが表示する `http://<PCのIPv4>:8000/` をiPhone Safariで開く。PCがスリープすると接続は切れる。

## 外部確認

外出先や別ネットワークから確認したいときは、GitHub PagesのURLを使う。修正はデスクトップ側で行い、push後にActionsが `prototype/` をPagesへ公開する。

## Pages初期設定

1. GitHub上にリポジトリを作成する。
2. この作業ツリーに `origin` を設定する。
3. `master` または `main` にpushする。
4. GitHubの `Settings > Pages` で `Source` を `GitHub Actions` にする。
5. `Actions` タブで `Deploy prototype to GitHub Pages` の成功を確認する。

初回pushをCodexに依頼する場合は、GitHubリポジトリのURLを渡して次のように指示する。

```text
このURLをoriginに設定して、初回コミットを作り、masterへpushして。
https://github.com/<owner>/<repo>.git
```

## iPhoneからの指示の出し方

- 「このPages URLでカード選択後に盤面が見切れる」
- 「iPhone Safariでリプレイ再生ボタンが押しづらい」
- 「自軍/敵軍の切り替えをもっと上に出したい」

上のように、URL、操作手順、期待、実際の表示を短く書くと、デスクトップ側で修正しやすい。
