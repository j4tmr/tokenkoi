#!/usr/bin/env node
// 从 TokenKoi 采价接口拉取价格，写入 data/prices.json，并重新生成 README 里的价格排名：
// 先是一张各模型最低价的总览，再按模型列出全部服务商、按综合价从低到高排，每家带一个跳转按钮。
//
// 用法：
//   PRICES_URL=https://api.tokenkoi.com/v1/prices.json node scripts/sync.mjs
//   node scripts/sync.mjs --file path/to/prices.json    # 用本地文件，便于调试
//
// 未设置 PRICES_URL 且未传 --file 时直接跳过（采价接口上线前 workflow 不报错）。

import { readFile, writeFile, mkdir } from "node:fs/promises";

// 采价接口的数据版本。v3 相对 v1 只加了字段（channel_kind、缓存价、分段价等），这里用到的字段含义没变。
const SCHEMA_VERSION = 3;
const DATA_FILE = "data/prices.json";
const README = "README.md";
const FEATURED = "scripts/featured.json";
// 渠道 id → 跳转地址。链接属于展示层，放在本仓库维护，改地址不需要动采价引擎。
const CHANNELS = "scripts/channels.json";
const START = "<!-- prices:start -->";
const END = "<!-- prices:end -->";

async function load() {
  const i = process.argv.indexOf("--file");
  if (i !== -1) return JSON.parse(await readFile(process.argv[i + 1], "utf8"));

  const url = process.env.PRICES_URL;
  if (!url) return null;
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`拉取 ${url} 失败：HTTP ${res.status}`);
  return res.json();
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

const beijing = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const time = (iso) => beijing.format(new Date(iso));
// 价格低于 0.1 元时保留两位有效数字，免得都显示成 ¥0。
const yuan = (n) => `¥${n > 0 && n < 0.1 ? Number(n.toPrecision(2)) : Number(n.toFixed(2))}`;

// 与采价引擎一致：综合价按输入 : 输出 = 3 : 1 加权。
const blended = (o) => (o.input * 3 + o.output) / 4;

const KIND = { official: "原厂", cloud: "国内云", relay: "中转站" };

// 相对官方价：便宜的写几折，贵的写贵多少。
function vsOfficial(offer, official) {
  if (offer.official) return "官方价";
  if (!official) return "—";
  const ratio = blended(offer) / blended(official);
  if (Math.abs(ratio - 1) < 0.005) return "同官方价";
  if (ratio < 1) return `${Number((ratio * 10).toFixed(1))} 折`;
  return `贵 ${Math.round((ratio - 1) * 100)}%`;
}

// GitHub 给标题生成锚点的规则：转小写、去掉标点、空格变连字符。
const anchor = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");

function button(offer, urls) {
  const url = urls[offer.channel];
  if (!url) return "—";
  const badge = `https://img.shields.io/badge/${encodeURIComponent("前往 ↗")}-2563eb?style=flat-square`;
  return `[![前往 ${offer.channel_name}](${badge})](${url})`;
}

function renderRanking(doc, featured, urls) {
  const byId = new Map(doc.models.map((m) => [m.id, m]));
  const missing = featured.filter((id) => !byId.has(id));
  if (missing.length) console.warn(`::warning::featured.json 中这些模型不在数据里：${missing.join(", ")}`);
  const models = featured.filter((id) => byId.has(id)).map((id) => byId.get(id));

  const noUrl = [...new Set(models.flatMap((m) => m.offers).filter((o) => !urls[o.channel]).map((o) => o.channel))];
  if (noUrl.length) console.warn(`::warning::channels.json 中缺少这些渠道的跳转地址：${noUrl.join(", ")}`);

  // 只有一家服务商的模型，总览那一行已经说全了，不再单列排名表。
  const ranked = models.filter((m) => m.offers.length > 1);

  const overview = models.map((m) => {
    const others = m.offers.length - 1;
    const name = others > 0 ? `[\`${m.id}\`](#${anchor(m.id)})` : `\`${m.id}\``;
    return `| ${name} | ${m.best.channel_name} | ${yuan(m.best.input)} | ${yuan(m.best.output)} | ${vsOfficial(m.best, m.official)} | ${others > 0 ? `另有 ${others} 家，见下方排名` : "仅此一家"} | ${button(m.best, urls)} |`;
  });

  const details = ranked.flatMap((m) => {
    const offers = [...m.offers].sort((a, b) => blended(a) - blended(b) || Number(b.official) - Number(a.official));
    return [
      "",
      `### ${m.id}`,
      "",
      "| # | 服务商 | 类型 | 输入 | 输出 | 综合价 | 相对官方 | |",
      "| ---: | --- | --- | ---: | ---: | ---: | :---: | :---: |",
      ...offers.map(
        (o, i) =>
          `| ${i + 1} | ${o.channel_name} | ${KIND[o.channel_kind] ?? o.channel_kind} | ${yuan(o.input)} | ${yuan(o.output)} | ${yuan(blended(o))} | ${vsOfficial(o, m.official)} | ${button(o, urls)} |`,
      ),
    ];
  });

  return [
    `> 单位：人民币 / 百万 token · 价格更新于 ${time(doc.updated_at)}，最近核对 ${time(doc.checked_at)}（北京时间）`,
    `> 汇率 1 USD = ${doc.fx.usd_cny} CNY · 共 ${doc.models_count} 个模型、${doc.channels_count} 个渠道，完整数据见 [\`data/prices.json\`](data/prices.json)`,
    "",
    "| 模型 | 最低价服务商 | 输入 | 输出 | 相对官方 | 其他服务商 | |",
    "| --- | --- | ---: | ---: | :---: | :---: | :---: |",
    ...overview,
    ...details,
  ].join("\n");
}

const doc = await load();
if (!doc) {
  console.log("::notice::未设置 PRICES_URL，跳过同步");
  process.exit(0);
}
if (doc.schema_version !== SCHEMA_VERSION || !Array.isArray(doc.models)) {
  throw new Error(`数据格式不符：schema_version=${doc.schema_version}，本脚本支持 ${SCHEMA_VERSION}`);
}

// 接口有 5 分钟缓存，拿到比仓库里更旧的数据时不回退。
const existing = await readExisting();
if (existing && doc.checked_at < existing.checked_at) {
  console.log(`::notice::接口数据（${doc.checked_at}）旧于仓库数据（${existing.checked_at}），跳过`);
  process.exit(0);
}

await mkdir("data", { recursive: true });
await writeFile(DATA_FILE, `${JSON.stringify(doc, null, 2)}\n`);

const featured = JSON.parse(await readFile(FEATURED, "utf8"));
const urls = JSON.parse(await readFile(CHANNELS, "utf8"));
const readme = await readFile(README, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1 || end < start) throw new Error(`README 缺少 ${START} / ${END} 标记`);

const next = `${readme.slice(0, start + START.length)}\n${renderRanking(doc, featured, urls)}\n${readme.slice(end)}`;
await writeFile(README, next);
console.log(`已同步：${doc.models_count} 个模型，价格更新于 ${doc.updated_at}`);
