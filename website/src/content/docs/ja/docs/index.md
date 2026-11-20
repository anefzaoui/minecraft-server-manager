---
title: 'ドキュメント'
description: 'itzg/docker-minecraft-server 用の完全なセルフホスト型コントロールパネル。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)用の、完全なセルフホスト型コントロールパネルです。ブラウザからMinecraftサーバーを作成、実行、管理できます。コマンドラインや手動でのYAML編集は不要です。

![ダッシュボード](/docs/images/dashboard.png)

## ここから始める

- **[はじめに](/docs/getting-started/)** - 初回セットアップ、サインイン、操作方法について。
- **[ダッシュボード](/docs/dashboard/)** - すべてのサーバー、プレイヤー、アクティビティを一目で確認できるビュー。

## サーバーの実行

- **[サーバーの作成と管理](/docs/servers/)** - 作成ウィザード、サーバーの種類、バージョン、サーバーごとの設定。
- **[コンソールとチャットコマンド](/docs/console-and-chat/)** - ライブコンソールと、プレイヤーとして実行されるカスタムゲーム内チャットコマンド。
- **[Modパック](/docs/modpacks/)** - CurseForge、Modrinth、FTB、GT New Horizonsのパックを、常に正確なバージョンに固定してインストールします。
- **[ワールドとファイル](/docs/worlds-and-files/)** - ワールドの交換、Modの管理、ファイルの編集をブラウザで直接行います。
- **[ワールドの縮小](/docs/world-shrink/)** - 誰も訪れないチャンクを削除してディスクスペースを解放します。単独でもバックアップの一部としても実行できます。
- **[ライブマップ](/docs/live-map/)** - パネルのサインインの背後にある、ワンクリックでBlueMap 3Dマップを表示します。
- **[招待とステータスページ](/docs/invites-and-status-page/)** - 友人向けのサーバーアドレス、招待文、クライアントModパック、および公開ステータスページ。

## データと自動化

- **[サーバーごとのチャットボット](/docs/chatbot/)** - ローカル/OpenAI互換の会話、アウトリーチ、保持されたトランスクリプト、および制約されたゲームプレイ機能。
- **[バックアップ](/docs/backups/)** - ワンクリックのスナップショット、スケジュールされたバックアップ、保持する数（パネル全体またはサーバーごと）、および復元。
- **[ブループリント](/docs/blueprints/)** - サーバーの構成全体をキャプチャし、それから新しいサーバーを作成します。
- **[スケジュール](/docs/schedules/)** - cron駆動の再起動、バックアップ、およびコマンド。
- **[ストレージ](/docs/storage/)** - サーバーごとのディスク使用量とパネルで強制されるクォータ。
- **[アップデート](/docs/updates/)** - 新しいサーバー、パック、イメージ、Modのバージョンを追跡し、ModがサポートするMinecraftバージョンを確認し、Modのアップデートを元に戻します。
- **[アクティビティログ](/docs/activity/)** - 発生したすべてのことの監査証跡。
- **[統合](/docs/integrations/)** - Discordウェブフック通知とアラートカテゴリ。
- **[パブリックAPI](/docs/public-api/)** - パネル外からサーバーのステータスを取得するための、読み取り専用のトークン認証HTTP API。

## アカウントとセキュリティ

- **[ユーザーとロール](/docs/users-and-roles/)** - 管理者、オペレーター、ビューアー、それぞれの権限、およびそれらを細分化するサーバーごとの権限。
- **[二要素認証](/docs/two-factor-authentication/)** - 認証アプリでログインを保護します。

## ガイド

このパネルに固有ではない、すべてのMinecraftサーバー所有者が直面する質問。

- **[サーバーに必要なRAMの量](/docs/guide-server-memory/)** - 設定すべき2つの数値と、アイドル状態のサーバーが12GBと表示される理由。
- **[Vanilla、Paper、Fabric、Forge、NeoForge、Quilt](/docs/guide-choosing-a-loader/)** - どちらを実行するか、そしてその選択の背後にあるプラグイン/Modの違い。
- **[サーバーが起動しない場合](/docs/guide-server-wont-start/)** - ログの読み方と、ほとんどの障害の背後にあるいくつかの原因。
- **[実際に復元できるバックアップ](/docs/guide-backups/)** - 一貫性のあるコピー、他に保持すべきもの、そして必要になる前にテストする方法。
- **[サーバーを別のホストに移動する](/docs/guide-moving-a-server/)** - ダウンタイムを短くし、インベントリを無傷に保つための順序。

## 内部構造

- **[アーキテクチャ](/docs/architecture/)** - パネルがどのように構築されているか。
- **[ウェブサイト](/docs/website/)** - minecraft-server-manager.comがこのリポジトリからどのように構築、翻訳、デプロイされているか。

---

> これらのドキュメントのスクリーンショットは、パネルのダークテーマで撮影されています。OSがライトテーマを好まない限り、パネルはダークテーマで起動します。上部のバーにあるテーマ切り替えを使用して切り替えることができます。
