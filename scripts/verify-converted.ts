/**
 * Незалежна звірка перенесення: старий документ проти нової моделі, пісня за
 * піснею. Не довіряє конвертеру — перераховує все сама зі старого стану.
 * Одноразова, як і `convert-songs.ts`; видалити разом із ним.
 *
 *   tsx scripts/verify-converted.ts <export.json> <out.json>
 *
 * export.json — [{ songId, state }] старих станів (те саме, що їло `convert-songs.ts`);
 * out.json    — { songs: [{ songId, state }] } нових станів: вихід конвертера
 *               або те, що прочитано назад із бази після запису.
 * Код виходу 1 — є проблеми.
 */
import { readFileSync } from "node:fs";
import * as Y from "yjs";
import { yTextToSlateElement } from "@slate-yjs/core";
import {
  chordsString,
  dynamicsOf,
  layout,
  readCapo,
  readHiddenLanes,
  readMeta,
  resolveNotes,
  songOf,
} from "../src/modules/SongDocument/model";

type Old = { type?: string; text?: string; children?: Old[]; [key: string]: unknown };

const [exportPath, outPath] = process.argv.slice(2);
if (!outPath) throw new Error("usage: verify-converted <export.json> <out.json>");

const exported = JSON.parse(readFileSync(exportPath, "utf8")) as { songId: number; state: string }[];
const converted = (JSON.parse(readFileSync(outPath, "utf8")) as { songs: { songId: number; state: string }[] }).songs;

const textOf = (n: Old): string => (n.children ?? []).map((c) => (typeof c.text === "string" ? c.text : textOf(c))).join("");
const norm = (s: string) => s.replace(/^\/+/, "").replace(/\s+/g, " ").trim();
const words = (parts: string[]) => parts.join(" ").split(" ").sort().join(" ");

const problems: string[] = [];
const total = { songs: 0, rows: 0, structural: 0, notes: 0, capo: 0, capoOff: 0, hidden: 0, painted: 0 };

for (const { songId, state } of exported) {
  const fail = (what: string) => problems.push(`${songId}: ${what}`);
  const oldDoc = new Y.Doc();
  Y.applyUpdate(oldDoc, Buffer.from(state, "base64"));
  const old = (yTextToSlateElement(oldDoc.get("content", Y.XmlText) as Y.XmlText).children ?? []) as Old[];
  const [nameNode, metaRow] = old;

  const mine = converted.find((c) => c.songId === songId);
  if (!mine) {
    fail("немає в перенесених");
    continue;
  }
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(mine.state, "base64"));
  const song = songOf(doc);
  const lines = layout(song);
  total.songs++;
  total.rows += lines.length;

  // 1. Текст: усі непорожні старі рядки (повторені секції — стільки разів, скільки повторів)
  //    = усі непорожні доріжки нових рядків, слово в слово (мітки з «/» і розклеєні — теж).
  const oldTexts: string[] = [];
  for (const section of old.filter((n) => n.type === "section")) {
    const times = typeof section.repeat === "number" && section.repeat > 1 ? section.repeat : 1;
    for (let k = 0; k < times; k++) (section.children ?? []).forEach((ch) => norm(textOf(ch)) && oldTexts.push(norm(textOf(ch))));
  }
  const newTexts: string[] = [];
  for (const l of lines) {
    if (l.words.startsWith("/")) total.structural++;
    if (norm(l.words)) newTexts.push(norm(l.words));
    if (norm(chordsString(l.line))) newTexts.push(norm(chordsString(l.line)));
  }
  if (words(oldTexts) !== words(newTexts)) fail("текст не збігся");

  // 2. Шапка й особисте.
  if (readMeta(doc).name !== textOf(nameNode)) fail("назва");
  const capo = (metaRow.children ?? []).find((c) => c.type === "capo") ?? {};
  for (const [nick, fret] of Object.entries((capo.valuesBy as Record<string, number>) ?? {})) {
    if (!fret) continue;
    total.capo++;
    if (readCapo(doc, nick).fret !== fret) fail(`капо ${nick}`);
  }
  for (const nick of (capo.disabledFor as string[]) ?? []) {
    total.capoOff++;
    if (!readCapo(doc, nick).off) fail(`вимкнене капо ${nick}`);
  }
  for (const nick of (metaRow.chordsHiddenFor as string[]) ?? []) {
    total.hidden++;
    if (!readHiddenLanes(doc, nick).includes("chords")) fail(`сховані акорди ${nick}`);
  }
  for (const nick of (metaRow.lyricsHiddenFor as string[]) ?? []) {
    total.hidden++;
    if (!readHiddenLanes(doc, nick).includes("words")) fail(`сховані слова ${nick}`);
  }

  // 3. Примітки: кожна стара (запис або позначка на тексті) є, з тим самим текстом,
  //    кольором і адресатами, і щось позначає.
  const ids = new Set(Object.keys(metaRow).filter((k) => k.startsWith("note:")).map((k) => k.slice(5)));
  const collect = (n: Old) => {
    for (const mark of (n.comment as { commentId: string }[] | undefined) ?? []) ids.add(mark.commentId);
    (n.children ?? []).forEach(collect);
  };
  old.forEach(collect);
  const stored = new Map<string, { body: string; color: string; visibleFor: string[]; quote: string }>();
  for (const l of lines) {
    for (const lane of ["chords", "words"] as const) {
      ((l.line.get(lane) as Y.Map<unknown>).get("notes") as Y.Map<never>).forEach((n, id) => stored.set(id, n));
    }
  }
  for (const id of ids) {
    const note = stored.get(id);
    if (!note) {
      fail(`примітки ${id} немає`);
      continue;
    }
    total.notes++;
    const record = metaRow[`note:${id}`] as { body?: string; color?: string; visibleFor?: string[] } | undefined;
    if (record && (record.body !== note.body || record.color !== note.color || JSON.stringify(record.visibleFor) !== JSON.stringify(note.visibleFor))) {
      fail(`запис примітки ${id} змінився`);
    }
    const audience = note.visibleFor.includes("all") ? [] : note.visibleFor;
    const shown = resolveNotes(song, audience, () => true).find((v) => v.note.id === id);
    if (!shown || shown.status === "lost") fail(`примітка ${id} нічого не позначає`);
    else if (!note.quote.trim()) fail(`примітка ${id} позначає порожнечу`);
  }
  if (stored.size !== ids.size) fail(`приміток у новому ${stored.size}, у старому ${ids.size}`);

  // 4. Динаміка — рівно там, де вона була.
  const hadDynamics = old.some((n) => Array.isArray(n.dynamicsSteps) && n.dynamicsSteps.length > 0);
  const painted = lines.filter((l) => dynamicsOf(l.line)).length;
  total.painted += painted;
  if (hadDynamics !== painted > 0) fail("динаміка");
}

for (const { songId } of converted) {
  if (!exported.some((e) => e.songId === songId)) problems.push(`${songId}: є в перенесених, але немає у вивантаженні`);
}

console.log(total);
console.log(`проблем: ${problems.length}`);
problems.forEach((p) => console.log(" ", p));
if (problems.length) process.exit(1);
