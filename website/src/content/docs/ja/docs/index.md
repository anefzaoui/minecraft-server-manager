---
title: 'ドキュメント'
description: 'itzg/docker-minecraft-server 用の完全なセルフホスト型コントロールパネル。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 用の、自己ホスト型コントロールパネルです。ブラウザから Minecraft サーバーを作成、実行、管理できます。コマンドラインや手動での YAML 編集は不要です。

![ダッシュボード](/docs/images/dashboard.png)

## まずはこちらから

- **[はじめに](/docs/getting-started/)** - 初回セットアップ、サインイン、操作方法について。
- **[ダッシュボード](/docs/dashboard/)** - すべてのサーバー、プレイヤー、アクティビティを一目で確認できます。

## サーバーの実行

- **[サーバーの作成と管理](/docs/servers/)** - 作成ウィザード、サーバーの種類、バージョン、サーバーごとの設定。
- **[コンソールとチャットコマンド](/docs/console-and-chat/)** - ライブコンソールと、プレイヤーとして実行されるカスタムゲーム内チャットコマンド。
- **[Modパック](/docs/modpacks/)** - CurseForge、Modrinth、FTB、GT New Horizons のパックを、常に正確なバージョンに固定してインストールします。
- **[ワールドとファイル](/docs/worlds-and-files/)** - ワールドの切り替え、Mod の管理、ブラウザでのファイルの直接編集。
- **[ワールドの縮小](/docs/world-shrink/)** - 誰も訪れないチャンクを削除してディスク容量を再利用します。単独で実行することも、バックアップの一部として実行することもできます。

## データと自動化

- **[サーバーごとのチャットボット](/docs/chatbot/)** - ローカル/OpenAI 互換の会話、アウトリーチ、記録されたトランスクリプト、制約されたゲームプレイ機能。
- **[バックアップ](/docs/backups/)** - ワンクリックのスナップショット、スケジュールされたバックアップ、復元。
- **[ブループリント](/docs/blueprints/)** - サーバーの構成全体をキャプチャし、それから新しいサーバーを作成します。
- **[スケジュール](/docs/schedules/)** - cron 駆動の再起動、バックアップ、コマンド。
- **[ストレージ](/docs/storage/)** - サーバーごとのディスク使用量とパネルで強制されるクォータ。
- **[アップデート](/docs/updates/)** - 新しいサーバー、パック、イメージ、Mod のバージョンを追跡します。
- **[アクティビティログ](/docs/activity/)** - 発生したすべての出来事の監査証跡。
- **[統合](/docs/integrations/)** - Discord ウェブフック通知とアラートカテゴリ。
- **[パブリック API](/docs/public-api/)** - パネル外からサーバーのステータスを取得するための、読み取り専用のトークン認証 HTTP API。

## アカウントとセキュリティ

- **[ユーザーとロール](/docs/users-and-roles/)** - 管理者、オペレーター、ビューアー、およびそれぞれの権限。
- **[二要素認証](/docs/two-factor-authentication/)** - 認証アプリでログインを保護します。

## 内部構造

- **[アーキテクチャ](/docs/architecture/)** - パネルがどのように構成されているか。
- **[ウェブサイト](/docs/website/)** - minecraft-server-manager.com がこのリポジトリからどのように構築、翻訳、デプロイされているか。

---

> これらのドキュメントのスクリーンショットは、パネルのダークテーマで撮影されています。OS がライトテーマを優先しない限り、パネルはダークテーマで起動します。上部のバーにあるテーマ切り替えを使用して切り替えてください。
