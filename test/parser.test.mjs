import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.split("// <parser>")[1].split("// </parser>")[0];
const api = new Function(code + "\nreturn {parseLine,groupTitle,cleanName,applyNames,computeStats,computeStory,wordStats,toTranscript,chunkTranscript,verifyBlocks};")();
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error("FAIL", msg, "\n got:", JSON.stringify(a), "\n exp:", JSON.stringify(b)); process.exit(1); } };

// ---- 1. 真實格式 (使用者提供的前幾行) ----
const real = `[LINE] 東海岸之聲名下的弓箭手村的聊天記錄
儲存日期： 2026/11/26 13:18

2025/08/28（四）
12:30\t\t⁨⁨Joseph Tree⁩⁩已新增⁨⁨許昶慶(Chang)⁩⁩, ⁨陳少博⁩⁩至群組。
12:30\tJoseph Tree\t我好懶 哈 還是拉群好了~
12:31\t陳少博\t笑死，乾脆明天去北騎樓下拉轉好了
12:35\t許昶慶(Chang)\t"六：竹山、阿里山
日：塔塔加
一：武嶺"
12:36\t許昶慶(Chang)\t"這週台南組要上來
不然我原本想往南跑 (emoji)"
12:36\t陳昀生 Shane\t這就有點硬了，他什麼時候上武嶺？
`;
const r = api.parseLine(real);
eq(r.length, 5, "real: system line skipped");
eq(api.groupTitle(real), "東海岸之聲名下的弓箭手村", "group title");
eq(r[2].text, "六：竹山、阿里山\n日：塔塔加\n一：武嶺", "real: multiline");
eq(api.computeStats(r).people.find((p) => p.name === "許昶慶(Chang)").emojiCount, 1, "(emoji) placeholder");

// ---- 2. 名字清理 / 合併 ----
eq(api.cleanName("Ellen🌟瑩"), "Ellen瑩", "strip emoji");
eq(api.cleanName("紫綺💖"), "紫綺", "strip emoji 2");
eq(api.cleanName("Annie❤️"), "Annie", "strip emoji + VS16");
eq(api.cleanName("劉ღ"), "劉", "strip georgian deco");
eq(api.cleanName("🌟"), "🌟", "all-symbol name is kept");
eq(api.cleanName("陳昀生 Shane"), "陳昀生 Shane", "plain name untouched");
const merged = api.applyNames([{ name: "A", ts: 0 }, { name: "A2", ts: 0 }], new Map([["A", "阿"], ["A2", "阿"]]));
eq(merged.map((m) => m.name), ["阿", "阿"], "same display name merges");

// ---- 3. 合成對話,驗證故事統計 ----
const msgs = [];
const T = (d, h, mi = 0) => new Date(2026, 0, d, h, mi).getTime();
const add = (ts, name, text) => msgs.push({ ts, name, text, kind: api.parseLine ? (/^\[貼圖\]$/.test(text) ? "sticker" : text === "已收回訊息" ? "unsent" : "text") : "text" });
// 1/1~1/10 每天有聊 (連續 10 天);1/11 沒聊;1/12~1/15 有聊;1/16、1/17 沒聊;1/18 有聊
for (let d = 1; d <= 10; d++) {
  add(T(d, 9 + (d % 3)), d % 2 ? "小安" : "阿明", "早安 xd");           // 每天誰先開口:小安奇數天、阿明偶數天
  add(T(d, 10 + (d % 3), 5), "小安", "好猛 xd");
  add(T(d, 23), "阿明", "晚上要騎車嗎 xd");                              // 深夜 23 點
}
add(T(3, 12), "小安", "[貼圖]"); add(T(3, 12, 1), "小安", "[貼圖]"); add(T(4, 12), "阿明", "[貼圖]");
add(T(5, 12), "阿明", "已收回訊息");
add(T(6, 15), "小安", "哈哈 🤣🤣🤣🤣 太好笑");                           // 連打 4 個
add(T(7, 15), "阿明", "🤣 笑死");
add(T(7, 16), "路人", "我是路人");
add(T(8, 16), "小安", "這是一則比較長的訊息，用來測最長訊息，一二三四五六七八九十，再多一點字");
for (let d = 12; d <= 15; d++) add(T(d, 10), "阿明", "早 xd");
add(T(18, 10), "小安", "最後一天第一則");
add(T(18, 11), "阿明", "最後一天第二則");
msgs.sort((a, b) => a.ts - b.ts);

const s = api.computeStory(msgs);
eq(s.total, msgs.length, "total");
eq(s.streakDays, 10, "longest streak = 10 consecutive days");
eq(s.longestGapDays, 2, "longest silent stretch = 2 days (1/16,1/17)");
eq(s.busiest.date, "2026/01/03", "busiest day (has stickers)");
eq(s.unsent, [{ name: "阿明", count: 1 }], "unsent");
eq(s.stickers.total, 3, "sticker total");
eq(s.stickers.list[0], { name: "小安", pct: 67 }, "sticker share");
eq(s.laugh.emoji, "🤣", "laugh emoji");
eq(s.laugh.record, { run: 4, name: "小安" }, "laugh record");
eq(s.laugh.list[0].name, "小安", "laugh top");
eq(s.lastDay.date, "2026/01/18", "last day");
eq(s.lastDay.msgs.map((m) => m.text), ["最後一天第一則", "最後一天第二則"], "last day msgs order");
eq(s.firstDay.date, "2026/01/01", "first day");
eq(s.longest[0].name, "小安", "longest msg owner");
eq(s.hours[23], 10, "hour histogram 23h");
eq(s.nightPct > 0, true, "night pct");
const ao = Object.fromEntries(s.openers.map((o) => [o.name, o.pct]));
eq(ao["小安"] > 0 && ao["阿明"] > 0, true, "openers both present");
eq(s.share.reduce((a, p) => a + p.pct, 0) + s.otherPct >= 99, true, "shares sum ~100");

// ---- 4. 字詞 / 口頭禪 (Intl.Segmenter) ----
const w = api.wordStats(msgs, new Set(msgs.map((m) => m.name)));
eq(w.catchphrases.some((x) => x.word === "xd"), true, "xd is a catchphrase");
eq(w.catchphrases.find((x) => x.word === "xd").count >= 30, true, "xd count");
eq(w.topWords.every((x) => x.word !== "xd"), true, "catchphrase excluded from top words");
eq(w.topWords.some((x) => ["小安", "阿明"].includes(x.word)), false, "names excluded");

// ---- 5. transcript / chunk / 引用驗證 ----
eq(api.toTranscript(msgs).split("\n")[0], "## 2026/01/01", "transcript header");
eq(api.chunkTranscript("a\nb\nc", 3).length, 2, "chunk");
const v = api.verifyBlocks([
  { kind: "text", text: "敘事" },
  { kind: "quote", text: "好猛 xd" },
  { kind: "quote", text: "這句根本不存在" },
], msgs);
eq([v.kept.length, v.dropped], [2, 1], "quote verification keeps text + real quote, drops fake");
console.log("all tests passed");
