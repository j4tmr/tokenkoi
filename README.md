# TokenKoi

大模型 token 价格与套餐比价导航。每个模型按价格从低到高列出各家服务商、相对官方价打几折，点按钮直达对应平台。

完整比价与历史走势见 [tokenkoi.com](https://tokenkoi.com)（建设中）。

## 价格排名

<!-- prices:start -->
> 等待采价接口上线后自动生成。
<!-- prices:end -->

## 数据怎么来的

```
采价引擎（私有，Cloudflare Worker）
  每 6 小时采集各渠道价格 → 统一换算成「人民币 / 百万 token」→ 存快照
  价格有变化 → 通知本仓库
        │
本仓库的 Actions（.github/workflows/sync-prices.yml）
  收到通知或每天定时 → 拉取 /v1/prices.json → 更新 data/prices.json 与上表 → 有变化才提交
```

- 官方价以 LiteLLM 的 [`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) 为基线，按每日汇率换算成人民币（`fx` 字段记录了用的是哪天、哪个来源的汇率）。
- 现阶段收录原厂 API 与国内云平台（阿里云百炼、火山引擎）。
- 排名按综合价从低到高，综合价按输入 : 输出 = 3 : 1 加权；与官方同价时官方排前。
- 「相对官方」= 该服务商的综合价 ÷ 官方综合价，便宜的写几折，贵的写贵多少。

`data/prices.json` 的字段说明：

| 字段 | 含义 |
| --- | --- |
| `updated_at` | 价格最近一次变化的时间 |
| `checked_at` | 最近一次采价成功的时间，价格没变也会刷新 |
| `fx.usd_cny` | 换算用的汇率 |
| `models[].best` | 最低价报价：渠道、输入价、输出价 |
| `models[].official` | 原厂报价，没有时为 `null` |
| `models[].discount` | 相对官方的比例，没有官方价时为 `null` |
| `models[].offers` | 该模型全部渠道的报价；`channel_kind` 区分原厂 / 国内云 / 中转站 |

README 展示哪些模型由 [`scripts/featured.json`](scripts/featured.json) 决定；各服务商的跳转地址在 [`scripts/channels.json`](scripts/channels.json)（渠道 id → 网址），新渠道没配地址时按钮留空，同步日志会给出警告。

## 后续（暂缓）

- 中转站实付价：把各家中转站口径不一的倍率折算成同一个可比数字——每 100 万 token 实付人民币，按模型族分开。
- 信任信号：上线时长、能否小额充值、余额可否退款。
- 跑路黑名单与近 30 天降价榜。
- agent 比较页（CLI / TUI / GUI 等形态字段）。

## 命名与域名

品牌 TokenKoi（koi 即锦鲤），域名 `tokenkoi.com`。
