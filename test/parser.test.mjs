import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.split("// <parser>")[1].split("// </parser>")[0];
const api = new Function(code + "\nreturn {parseLine,computeStats,toTranscript,chunkTranscript,verifyQuotes};")();
const sample = `[LINE] 與朋友群的聊天記錄
儲存日期：2026/11/26 10:00

2026/11/20（五）
14:06\t小安\t週六還是照約嗎？
14:10\t阿明\t我訂了信義區那間，8 點
14:14\t小安\t啊抱歉我現在才看到 😅
14:18\t阿明\t"你凌晨兩點還在發限動
我都看到了"
14:20\t小安\t[貼圖]
14:21\t阿明加入群組
2026/11/21（六）
上午12:30\t小安\t哈哈哈哈
下午3:05\t阿明\t[照片]
下午3:06\t小安\t已收回訊息
`;
const m = api.parseLine(sample);
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error("FAIL", msg, a, b); process.exit(1); } };
eq(m.length, 8, "count (system msg skipped)");
eq(m[3].text, "你凌晨兩點還在發限動\n我都看到了", "multiline + quote strip");
eq(m[4].kind, "sticker", "sticker");
eq(new Date(m[5].ts).getHours(), 0, "上午12 -> 0");
eq(new Date(m[6].ts).getHours(), 15, "下午3 -> 15");
eq(m[7].kind, "unsent", "unsent");
const s = api.computeStats(m);
eq(s.people.length, 2, "people");
eq(s.people.find(p=>p.name==="小安").lateNightMessages, 1, "late night");
const t = api.toTranscript(m);
eq(t.split("\n")[0], "## 2026/11/20", "transcript header");
const v = api.verifyQuotes([{quote:"你凌晨兩點還在發限動"},{quote:"這句不存在"}], m);
eq([v.kept.length, v.dropped], [1,1], "quote verify");
eq(api.chunkTranscript("a\nb\nc", 3).length, 2, "chunk");

// 真實格式 (使用者提供): 雙向隔離字元、空名字欄系統訊息、(emoji)、多行引號
const real = `[LINE] 東海岸之聲名下的弓箭手村的聊天記錄
儲存日期： 2026/11/26 13:18

2025/08/28（四）
12:30\t\t\u2068\u2068Joseph Tree\u2069\u2069已新增\u2068\u2068許昶慶(Chang)\u2069\u2069, \u2068陳少博\u2069\u2069至群組。
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
eq([...new Set(r.map(x=>x.name))], ["Joseph Tree","陳少博","許昶慶(Chang)","陳昀生 Shane"], "real: names");
eq(r[2].text, "六：竹山、阿里山\n日：塔塔加\n一：武嶺", "real: multiline");
const rs = api.computeStats(r);
eq(rs.people.find(p=>p.name==="許昶慶(Chang)").emojiCount, 1, "real: emoji placeholder");
console.log("all parser tests passed");
