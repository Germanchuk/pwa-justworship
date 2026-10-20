/**
 * Чи ручні рішення по рядках (`decisions.json`) досі покривають пісні.
 * Знаходить ті самі кандидати, що й під час ручного розбору 2026-10-18
 * (мітки структури на початку секції, «слова», що насправді акорди), і
 * порівнює з рішеннями. Різниця — це пісні, які правили після розбору:
 * їх треба переглянути руками, перш ніж переносити. Одноразовий, як і
 * `convert-songs.ts`; видалити разом із ним.
 *
 *   tsx scripts/review-rows.ts <export.json> <decisions.json> [fresh.json]
 *
 * Код виходу 1 — є різниця (кандидат без рішення або рішення без кандидата).
 * `fresh.json` — куди записати свіжий список, якщо різниця переглянута й прийнята.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as Y from "yjs";
import { yTextToSlateElement } from "@slate-yjs/core";
import type { RowDecision } from "../src/modules/SongDocument/convert/fromSlate";

type Old = { type?: string; text?: string; children?: Old[] };
type Decision = RowDecision & { songId: number };

const [exportPath, decisionsPath, freshPath] = process.argv.slice(2);
if (!decisionsPath) throw new Error("usage: review-rows <export.json> <decisions.json> [fresh.json]");

const LOOKALIKE: Record<string, string> = { А: "A", В: "B", С: "C", Е: "E", Н: "H", а: "a", с: "c", е: "e", м: "m", о: "o", х: "x", Х: "X" };
const norm = (s: string) => s.replace(/[​ ﻿]/g, " ").replace(/[АВСЕНасемохХ]/g, (c) => LOOKALIKE[c]);
const CHORD = /^\(?[A-H][#b♯♭]?(m|maj|min|dim|aug|sus|add|M|[0-9]|[#b+\-°ø/()`]|[A-H][#b]?)*\)?[.,]?$/;
const BAR = /^(\||\.+|:|x\d+|\(x\d+\)|\d+x|-|_|!|\/|%|\|:|:\|)$/i;
const isChordToken = (t: string) => CHORD.test(t) || BAR.test(t);
const STRUCTURE =
  /^[[(]?\s*(\d+\s*(ий\s*)?)?(приспів|приcпів|припев|куплет|програш|мікро-програш|міст|перед[- ]?приспів|передприспів|пред[- ]?приспів|пре[- ]?приспів|пр\s*-\s*\S+|пр-\S+|вступ|інтро|интро|інструментал|брідж|бридж|тег|закінчення|кінцівка|кiнeць|заспів|інтерлюдія|chorus|verse|bridge|intro|instrumental|interlude|outro|tag|turnaround|pre[- ]?chorus|ending|refrain)/iu;
/** Схожі на акорди, але слова — вирішено руками 2026-10-18. */
const WORDS_NOT_CHORDS = new Set(["Останній аккорд: G", "В мить! О-о-о-у!", "В безмежній милості", "E - лo - xiм, Tи шляx прoклaв для мeнe"]);

const textOf = (n: Old) => (n.children ?? []).map((c) => c.text ?? "").join("");

/** Звідки до кінця рядка — самі акорди (мітка з акордами `[CHORUS] G A Hm D`); −1 — ні. */
function chordTail(s: string) {
  const parts = [...s.matchAll(/\S+/g)];
  let k = parts.length;
  while (k > 0 && isChordToken(norm(parts[k - 1][0]))) k--;
  while (k < parts.length && !CHORD.test(norm(parts[k][0])) && parts[k][0] !== "|") k++; // «-», «(X2)» — до мітки
  const chords = parts.slice(k).filter((p) => CHORD.test(norm(p[0]))).length;
  return chords >= 1 && k < parts.length ? parts[k].index! : -1;
}

function candidates(songId: number, nodes: Old[]): Decision[] {
  const out: Decision[] = [];
  let sec = 0;
  for (const section of nodes) {
    if (section.type !== "section") continue;
    sec++;
    (section.children ?? []).forEach((child, row) => {
      if (child.type !== "line" && child.type !== "chord-line") return;
      const text = textOf(child);
      const t = text.trim();
      if ((row === 0 && STRUCTURE.test(t)) || (t.startsWith("[") && STRUCTURE.test(t))) {
        const cut = chordTail(text);
        out.push(
          cut > 0
            ? { songId, sec, row, text, as: "note+chords", note: "/" + text.slice(0, cut).trim(), chords: text.slice(cut).replace(/\s+$/, "") }
            : { songId, sec, row, text, as: "note", note: "/" + t },
        );
        return;
      }
      if (child.type !== "line" || WORDS_NOT_CHORDS.has(t)) return;
      const tokens = norm(text).split(/[\s|]+/).filter(Boolean);
      const chords = tokens.filter((x) => CHORD.test(x)).length;
      if (chords >= 1 && tokens.filter(isChordToken).length / tokens.length >= 0.5) out.push({ songId, sec, row, text, as: "chords" });
    });
  }
  return out;
}

const exported = JSON.parse(readFileSync(exportPath, "utf8")) as { songId: number; state: string }[];
const decisions = JSON.parse(readFileSync(decisionsPath, "utf8")) as Decision[];

const fresh = exported.flatMap(({ songId, state }) => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(state, "base64"));
  return candidates(songId, (yTextToSlateElement(doc.get("content", Y.XmlText) as Y.XmlText).children ?? []) as Old[]);
});

const key = (d: Decision) => JSON.stringify([d.songId, d.sec, d.row, d.as, d.text, d.note ?? null, d.chords ?? null]);
const known = new Set(decisions.map(key));
const found = new Set(fresh.map(key));
const added = fresh.filter((d) => !known.has(key(d)));
const gone = decisions.filter((d) => !found.has(key(d)));

console.log(`кандидатів ${fresh.length}, рішень ${decisions.length}`);
added.forEach((d) => console.log(`  НОВИЙ   ${d.songId}/${d.sec}/${d.row} ${d.as}: ${JSON.stringify(d.text)}`));
gone.forEach((d) => console.log(`  ЗНИК    ${d.songId}/${d.sec}/${d.row} ${d.as}: ${JSON.stringify(d.text)}`));
if (freshPath) writeFileSync(freshPath, JSON.stringify(fresh, null, 1));
if (added.length || gone.length) process.exit(1);
console.log("різниці немає");
