#!/usr/bin/env node
// 从 TokenKoi 采价接口拉取价格，写入 data/prices.json，并重新生成 README 里的价格摘要表。
//
// 用法：
//   PRICES_URL=https://api.tokenkoi.com/v1/prices.json node scripts/sync.mjs
//   node scripts/sync.mjs --file path/to/prices.json    # 用本地文件，便于调试
//
// 未设置 PRICES_URL 且未传 --file 时直接跳过（采价接口上线前 workflow 不报错）。

import { readFile, writeFile, mkdir } from "node:fs/promises";

const SCHEMA_VERSION = 1;
const DATA_FILE = "data/prices.json";
const README = "README.md";
const FEATURED = "scripts/featured.json";
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
const yuan = (n) => `¥${Number(n.toFixed(2))}`;

function discountLabel(model) {
  if (model.discount === null) return "—";
  if (model.best.official) return "官方价";
  return `${Number((model.discount * 10).toFixed(1))} 折`;
}

function renderTable(doc, featured) {
  const byId = new Map(doc.models.map((m) => [m.id, m]));
  const missing = featured.filter((id) => !byId.has(id));
  if (missing.length) console.warn(`::warning::featured.json 中这些模型不在数据里：${missing.join(", ")}`);

  const rows = featured
    .filter((id) => byId.has(id))
    .map((id) => {
      const m = byId.get(id);
      const official = m.official ? `${yuan(m.official.input)} / ${yuan(m.official.output)}` : "—";
      return `| \`${m.id}\` | ${m.best.channel_name} | ${yuan(m.best.input)} | ${yuan(m.best.output)} | ${official} | ${discountLabel(m)} |`;
    });

  return [
    `> 单位：人民币 / 百万 token · 价格更新于 ${time(doc.updated_at)}，最近核对 ${time(doc.checked_at)}（北京时间）`,
    `> 汇率 1 USD = ${doc.fx.usd_cny} CNY · 共 ${doc.models_count} 个模型、${doc.channels_count} 个渠道，完整数据见 [\`data/prices.json\`](data/prices.json)`,
    "",
    "| 模型 | 最低价渠道 | 输入 | 输出 | 官方价（输入 / 输出） | 相对官方 |",
    "| --- | --- | ---: | ---: | ---: | :---: |",
    ...rows,
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
const readme = await readFile(README, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1 || end < start) throw new Error(`README 缺少 ${START} / ${END} 标记`);

const next = `${readme.slice(0, start + START.length)}\n${renderTable(doc, featured)}\n${readme.slice(end)}`;
await writeFile(README, next);
console.log(`已同步：${doc.models_count} 个模型，价格更新于 ${doc.updated_at}`);
