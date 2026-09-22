/**
 * ЗІБРАННЯ — збірка служіння з пунктів списку для показу.
 *
 * Вхід — пункти списку плюс документ кожної пісні (той, що приїжджає з
 * ендпоінта зібрання). Вихід — ряд елементів, по одному на пункт: документ
 * пісні як є, згенерований документ програша, або текст примітки. Зібрання
 * нічого не зберігає (ADR-0001).
 *
 * Звуку зібрання зараз немає (ADR-0003): черга сегментів, адреси старту й
 * голка відкладені в `archive/chord-player` разом зі старим плеєром. Програш
 * при цьому лишився — як показ акордів переходу, які гурт грає сам.
 *
 * ─── ЧОМУ ЦЕ ЧИСТА ФУНКЦІЯ ─────────────────────────────────────────────────
 * Кожен музикант рахує програш на своєму пристрої. Ті самі пункти й документи
 * мусять давати ті самі акорди в усіх — тому тут немає ні часу, ні
 * випадковості, ні читання чогось поза аргументами.
 *
 * ─── ЩО ТАКЕ СУСІД ─────────────────────────────────────────────────────────
 * Сусід програша — це пункт, що стоїть ПОРУЧ, і лише коли він пісня. Примітка
 * між піснею й програшем — зупинка, тож вести з хвоста тієї пісні нема звідки:
 * цей шов порожній, як і край списку. Програш при цьому не зникає ніколи
 * (`LIST-39`).
 */

import type { Descendant } from "slate";

import {
  numberSongs,
  type ListPoint,
  type NotePoint,
  type SongPoint,
} from "#models/listPoint";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { keyDisplayName } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import { extractHeader } from "#modules/SingleSong/services/songChords/extractHeader";
import {
  isRest,
  songProgression,
  type ChordEvent,
} from "#modules/SingleSong/services/songChords/progression";
import { transpose as keyDownBy } from "#utils/keyUtils";

/** Пункт списку разом із вмістом своєї пісні — так його віддає ендпоінт. */
export type GatheringPoint = ListPoint & { slate?: Descendant[] | null };

interface BaseItem {
  /** Ключ пункту — той самий, що й у списку: потрібен лише рендеру. */
  key: string;
}

export interface GatheringSongItem extends BaseItem {
  kind: "song";
  point: SongPoint;
  /** Номер ПІСНІ, а не пункту (`LIST-27`). */
  number: number;
  nodes: Descendant[];
}

export interface GatheringNoteItem extends BaseItem {
  kind: "note";
  point: NotePoint;
  text: string;
}

/**
 * Програш — примітка, позначена як перехід. НЕ третій вид пункту (їх два,
 * `LIST-24`): той самий пункт-примітка, лише показує себе документом, а не
 * рядком.
 */
export interface GatheringSoundingItem extends BaseItem {
  kind: "sounding";
  point: NotePoint;
  text: string;
  /** Згенерований документ програша — показується так само, як пісня. */
  nodes: Descendant[];
}

export type GatheringItem = GatheringSongItem | GatheringNoteItem | GatheringSoundingItem;

export interface Gathering {
  items: GatheringItem[];
}

/** Усе, що програшу треба знати про пісню-сусіда. Читається з документа один раз. */
interface SongContext {
  key: SongKeyValue;
  progression: ChordEvent[];
}

const readSong = (nodes: Descendant[] | null | undefined): SongContext => {
  const safe = Array.isArray(nodes) ? nodes : [];
  const { timeSignature, key } = extractHeader(safe);
  return { key, progression: songProgression(safe, timeSignature[0]) };
};

// ─── Акорди програша ────────────────────────────────────────────────────────

/**
 * Ступінь тональності як назва акорда; `semitones` — скільки півтонів угору
 * від тоніки. Пишеться дієзами, бо дієзами записані самі тональності
 * (`keyUtils.keys`): у бемольній пісні виглядатиме енгармонічно (`Eb` → `D#`).
 */
const degree = (key: SongKeyValue, semitones: number): string =>
  // `keyUtils.transpose` рахує ВНИЗ, тож вгору на N — це вниз на 12 − N.
  keyDisplayName(keyDownBy(key, (12 - semitones) % 12) as SongKeyValue);

const tonic = (key: SongKeyValue) => degree(key, 0);
const subdominant = (key: SongKeyValue) => degree(key, 5);
/** Домінанта — єдине, заради чого потрібен ЯРЛИК тональності. Решта — з акордів. */
const dominantSeventh = (key: SongKeyValue) => `${degree(key, 7)}7`;

const lastSoundingChord = (progression: ChordEvent[]): string | null => {
  for (let i = progression.length - 1; i >= 0; i--) {
    if (!isRest(progression[i].chord)) return progression[i].chord;
  }
  return null;
};

const firstSoundingChord = (progression: ChordEvent[]): string | null =>
  progression.find((event) => !isRest(event.chord))?.chord ?? null;

/** Один акорд — один такт: `| Am | D7 |`. */
const barsOf = (chords: string[]): string => `| ${chords.join(" | ")} |`;

/**
 * Рядки програша: вихід із попередньої пісні на домінанту, коло I–IV у
 * тональності наступної, вхід у її перший акорд. Відсутній рядок означає, що з
 * того боку сусіда немає, — і цей шов порожній.
 */
const soundingLines = (prev: SongContext | null, next: SongContext | null): string[] => {
  // Коло живе в тональності НАСТУПНОЇ пісні: воно веде саме в неї. Немає
  // наступної — лишаємось там, звідки прийшли; немає жодної — у дефолтній
  // (`LIST-39`).
  const key = (next ?? prev)?.key ?? "C";
  const lines: string[] = [];

  if (prev) {
    const departure = lastSoundingChord(prev.progression);
    lines.push(barsOf([...(departure ? [departure] : []), dominantSeventh(key)]));
  }

  lines.push(barsOf([tonic(key), subdominant(key)]));

  // Пісня, у якій не звучить жоден акорд (немає розмічених тактів), — такий
  // самий порожній шов, як і відсутній сусід: входити нема в що.
  const arrival = next ? firstSoundingChord(next.progression) : null;
  if (arrival) lines.push(barsOf([arrival]));

  return lines;
};

/** Документ програша: текст примітки заголовком секції, під ним акорди. */
const soundingNodes = (text: string, lines: string[]): Descendant[] =>
  [
    {
      type: "section",
      children: [
        { type: "line", children: [{ text }] },
        ...lines.map((line) => ({ type: "chord-line", children: [{ text: line }] })),
      ],
    },
  ] as unknown as Descendant[];

// ─── Збірка ─────────────────────────────────────────────────────────────────

export function buildGathering(points: ReadonlyArray<GatheringPoint>): Gathering {
  const numbers = numberSongs(points);
  const songs = points.map((point) =>
    point.kind === "song" ? readSong(point.slate) : null,
  );

  const items = points.map((point, index): GatheringItem => {
    if (point.kind === "song") {
      return {
        kind: "song",
        key: point.key,
        point,
        number: numbers[index]!,
        nodes: Array.isArray(point.slate) ? point.slate : [],
      };
    }

    if (!point.sounding) {
      return { kind: "note", key: point.key, point, text: point.text };
    }

    // Сусід — лише пункт поруч, і лише пісня: примітка між ними означає
    // зупинку, тобто порожній шов.
    const prev = songs[index - 1] ?? null;
    const next = songs[index + 1] ?? null;
    return {
      kind: "sounding",
      key: point.key,
      point,
      text: point.text,
      nodes: soundingNodes(point.text, soundingLines(prev, next)),
    };
  });

  return { items };
}
