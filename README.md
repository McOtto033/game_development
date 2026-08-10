# 大将戦プロトタイプ

3x3 auto tactics prototype. The playable static build lives in `prototype/`.

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
git add .
git commit -m "Add game prototype and Pages deployment"
git push -u origin master
```

## リモート開発ループ

iPhoneではPages URLまたはローカル確認URLで実機操作します。修正したい点が出たら、このデスクトップ上のCodexタスクへ指示します。Codexがこの作業ツリーを編集し、push後にGitHub Pagesが自動更新されます。
