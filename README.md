# TokenKoi

大模型 token 价格与套餐比价导航。

## 状态

占位仓库，尚未开始实现。

## 命名与域名

品牌 TokenKoi（koi 即锦鲤），域名 `tokenkoi.com`。

## 现阶段范围

先做最简单的一版：官方模型 token 价格对照表。官方价以 LiteLLM 的 `model_prices_and_context_window.json` 为基线并注明来源，不自建数据。

## 后续（暂缓）

- 中转站实付价：把各家中转站口径不一的倍率折算成同一个可比数字——每 100 万 token 实付人民币，按模型族分开。
- 信任信号：上线时长、能否小额充值、余额可否退款。
- 跑路黑名单与近 30 天降价榜。
- agent 比较页（CLI / TUI / GUI 等形态字段）。

仓库公开，站点计划以 GitHub Pages + 自定义域名 `tokenkoi.com` 承载。
