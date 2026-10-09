# Content Guidelines (GCSA)

## 基本方針
- 本プロジェクトは教育目的。特定の国・文化・人々を一般化しない。
- 表現は「攻撃者がその傾向を **悪用しうる**」という枠組みで統一。
- Red Flags ↔ Mitigations を必ず対で記述し、行動可能な短文で。

## 編集チェックリスト
- [ ] 断定・偏見を避けた表現
- [ ] 最低 `ja` を充足（可能なら `en` も）
- [ ] `attack_vector/targets/mediums/tags` は制御語彙内
- [ ] `risk_score` の根拠は `references` に寄せる
- [ ] URL 生存確認済み
- [ ] ID 重複なし（国コード+連番）
- [ ] `verification.status` を付与（`verified`／`partial`／`unverified`）

## 制御語彙

- **attack_vector**: `in-person`, `phone`, `email`, `sms`, `social`, `website`, `payment-app`, `postal`, `door-to-door`, `marketplace`, `mixed`。
- **targets**: `tourist`, `general`, `elderly`, `business`, `student`, `expat`（在留外国人・駐在員）。
- **mediums**: `cash`, `credit`, `bank-transfer`, `cryptocurrency`, `gift-cards`, `e-wallet`, `qr-pay`。
  - `postal` は決済手段ではなく配送経路なので `attack_vector` に寄せる。
  - `identity-theft` は手段ではなく被害の種類なので `tags` に寄せる。

## 出典と確認状態

- 出典は国の官公庁・警察・消費者機関・金融当局・CERT の個別ページを第一に、次点で大手報道。個人ブログやまとめサイト、Wikipedia は使わない。
- `references[]` は `{label, url, publisher, accessed, quote}` の形で書く。`accessed` は `YYYY-MM-DD`、`quote` は本文からの逐語引用（200字以内）。
- `verification.status` は三段階である。
  - `verified`: 事例の手口（誰が・何を装い・どう金品や情報を取るか）を、個別ページが具体的に記述している。
  - `partial`: 総論ページや関連する注意喚起はあるが、事例の手口を個別には裏づけていない。
  - `unverified`: 裏づけとなる出典が見つからない（既存の references が死んでいる・無関係である場合を含む）。
- 要約の記憶や推測で `quote` を書かない。取得できなかったページを出典にしない。
