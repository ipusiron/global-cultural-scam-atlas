<!--
---
title: Global Cultural Scam Atlas (GCSA)
category: social-engineering
difficulty: 1
description: An educational, citation-driven database of scams that exploit cultural contexts across countries.
tags: [atlas, database, social-engineering, education, javascript]
demo: https://ipusiron.github.io/global-cultural-scam-atlas/
---
-->

# Global Cultural Scam Atlas (GCSA) - 

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/global-cultural-scam-atlas?style=social)
![GitHub forks](https://img.shields.io/github/forks/ipusiron/global-cultural-scam-atlas?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/global-cultural-scam-atlas)
![GitHub license](https://img.shields.io/github/license/ipusiron/global-cultural-scam-atlas)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/global-cultural-scam-atlas/)

**Global Cultural Scam Atlas(GCSA)** は、各国・地域で観測される **文化・慣習の文脈を悪用したソーシャルエンジニアリング** を、教育目的で整理する **オープンなデータベース** です。

特定の国民性を一般化する意図はなく、**「攻撃者がその傾向を悪用しうる」** という観点で事例を記述します。

---

## 🌐 デモページ

👉 **[https://ipusiron.github.io/global-cultural-scam-atlas/](https://ipusiron.github.io/global-cultural-scam-atlas/)**

ブラウザーで直接お試しいただけます。

---

## 📸 スクリーンショット

>!["Hello world."を暗号化する](assets/screenshot.png)
>*"Hello world."を暗号化する*

---

## 目的
- 旅行者・生活者・教育機関・実務家が **Red Flags（兆候）** と **Mitigations（対策）** を素早く学べる。
- データは **一次情報（公的機関、CERT、学術）** を中心に継続更新。

## データ構造（概要）
- **1攻撃 = 1ファイル**（`data/attacks/{ISO2}/{id}.json`）
- ビルド時に **`dist/countries.json`** へ集約（ツール内配信用）
- スキーマ：`data/schema.json`

## 推奨方式（Recommended Approach）の採用理由
本リポジトリでは **「1攻撃=1ファイルで管理し、ビルド時に集約するハイブリッド運用」** を採用します。理由は以下です。

1. **並行編集に強い**：差分が小さく、PRレビューが攻撃単位で完結。衝突が減る。  
2. **トレーサビリティ向上**：出典・変更履歴・責任範囲を攻撃ファイルごとに明確化。  
3. **ローカライズ容易**：各ファイルに `ja`/`en` を内包し、翻訳粒度を制御。  
4. **配信効率**：編集は分割、公開は集約でクライアント負荷を最小化。  
5. **CIで品質担保**：スキーマ検証・語彙Lint・リンクチェックをファイル単位で実行し、不整合の流出を防止。

---

## 使い方（データ消費側）

1. `dist/countries.json` を取得して国/攻撃カードを描画  
2. キー項目：`title`, `short_desc`, `cultural_lever`, `red_flags[]`, `mitigations[]`, `references[]`

---

## 免責

本データは教育目的であり、特定の国・文化・人々を一般化する意図はありません。出典は可能な限り一次情報を示し、リンク切れや更新は随時対応します。

---

## 📁 ディレクトリー構成

```
```

---

## 📄 ライセンス

MIT License – 詳細は [LICENSE](LICENSE) を参照してください。

---

## 🛠 このツールについて

本ツールは、「生成AIで作るセキュリティツール100」プロジェクトの一環として開発されました。
このプロジェクトでは、AIの支援を活用しながら、セキュリティに関連するさまざまなツールを100日間にわたり制作・公開していく取り組みを行っています。

プロジェクトの詳細や他のツールについては、以下のページをご覧ください。

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)
