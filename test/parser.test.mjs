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
console.log("all parser tests passed");
