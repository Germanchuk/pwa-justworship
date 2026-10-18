/**
 * Одноразове перенесення пісень у модель пісні (`src/modules/SongDocument/convert`).
 * Нічого не пише в базу: читає вивантаження й пише файл з новими станами.
 *
 *   tsx scripts/convert-songs.ts <export.json> <decisions.json> <out.json>
 *
 * export.json    — [{ songId, state }] з `song_collab_states` (state — base64 Yjs старого документа);
 * decisions.json — ручні рішення по рядках ([{ songId, sec, row, text, as, … }]);
 * out.json       — { songs: [{ songId, state }], warnings } — state нової моделі, base64.
 *
 * Перед запуском на свіжих даних — переглянути, чи не з'явились нові рядки-кандидати
 * (`justworship-meta/.scratch/segments-lanes/migration/review.mjs`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as Y from "yjs";
import { yTextToSlateElement } from "@slate-yjs/core";
import { convertSong, OldNode, RowDecision } from "../src/modules/SongDocument/convert/fromSlate";

const [exportPath, decisionsPath, outPath] = process.argv.slice(2);
if (!outPath) throw new Error("usage: convert-songs <export.json> <decisions.json> <out.json>");

const rows = JSON.parse(readFileSync(exportPath, "utf8")) as { songId: number; state: string }[];
const decisions = JSON.parse(readFileSync(decisionsPath, "utf8")) as (RowDecision & { songId: number })[];

const songs: { songId: number; state: string }[] = [];
const warnings: string[] = [];
const failures: string[] = [];
for (const { songId, state } of rows) {
  const old = new Y.Doc();
  Y.applyUpdate(old, Buffer.from(state, "base64"));
  const nodes = (yTextToSlateElement(old.get("content", Y.XmlText) as Y.XmlText).children ?? []) as OldNode[];
  try {
    const { doc, warnings: w } = convertSong(nodes, decisions.filter((d) => d.songId === songId));
    w.forEach((msg) => warnings.push(`${songId}: ${msg}`));
    songs.push({ songId, state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64") });
  } catch (err) {
    failures.push(`${songId}: ${(err as Error).message}`);
  }
}
writeFileSync(outPath, JSON.stringify({ songs, warnings }, null, 1));
console.log(`перенесено ${songs.length} з ${rows.length}; попереджень ${warnings.length}; помилок ${failures.length}`);
[...warnings, ...failures].forEach((line) => console.log(" ", line));
if (failures.length) process.exit(1);
