/**
 * ЗІБРАННЯ — збірка служіння з пунктів списку. Головний шов режиму.
 *
 * Вхід — пункти списку плюс документ кожної пісні (той, що приїжджає з
 * ендпоінта зібрання). Вихід — три речі, і всі три похідні: зібрання нічого не
 * зберігає (ADR-0001).
 *
 *   1. `items`    — ряд елементів для показу, по одному на пункт: документ
 *                   пісні як є, згенерований документ програша, або текст
 *                   примітки.
 *   2. `segments` — плоска наскрізна черга сегментів усього служіння.
 *   3. `tokens`   — відповідність «токен → сегмент і доля»: тап по акорду стає
 *                   точкою старту.
 *
 * ─── ЧОМУ ЦЕ МУСИТЬ БУТИ ЧИСТА ФУНКЦІЯ ─────────────────────────────────────
 * Звук зібрання йде на ОДНОМУ пристрої (хост), а програш показує КОЖЕН сам.
 * Недетермінований генератор означав би, що музиканти бачать не те, що звучить
 * (`LIST-35`). Тому тут немає ні часу, ні випадковості, ні читання чогось поза
 * аргументами — ті самі пункти й документи дають той самий результат байт у
 * байт на будь-якому пристрої.
 *
 * ─── ЧОМУ ПРОГРАШ ГЕНЕРУЄТЬСЯ ТЕКСТОМ ──────────────────────────────────────
 * Генератор видає звичайний акордовий РЯДОК і проганяє його тим самим лексером,
 * що й пісні. Одна дорога до звуку й до показу замість двох: програш не може
 * розійтися з правилами такту, а на екрані стає такою самою секцією, з такою
 * самою підсвіткою. Окремим швом генератор не є — він живе тут.
 *
 * ─── ЩО ТАКЕ СУСІД ─────────────────────────────────────────────────────────
 * Сусід програша — це пункт, що стоїть ПОРУЧ, і лише коли він пісня. Примітка
 * між піснею й програшем — справжня зупинка, тож вести з хвоста тієї пісні нема
 * звідки: цей шов є тишею, як і край списку. Програш при цьому не зникає
 * ніколи (`LIST-39`).
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
import { extractHeader } from "#modules/SingleSong/services/ChordsProgressionPlayer/extractHeader";
import { chordLineToProgressionMapWithKeys } from "#modules/SingleSong/services/ChordsProgressionPlayer/getMidiFromSections/utils/chordLineToProgressionMapWithKeys";
import {
  isRest,
  type ChordEvent,
} from "#modules/SingleSong/services/ChordsProgressionPlayer/getMidiFromSections/utils/createMidiFromProgression";
import { getProgressionFromSlate } from "#modules/SingleSong/services/ChordsProgressionPlayer/getMidiFromSlate/getMidiFromSlate";
import {
  canRampBetween,
  pointOfSegment,
  pointPrefix,
  prefixTokenKey,
  type PlaybackSegment,
} from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";
import {
  DEFAULT_BPM,
  DEFAULT_TIME_SIGNATURE,
} from "#modules/SingleSong/services/ChordsProgressionPlayer/songDefaults";
import { transpose as keyDownBy } from "#utils/keyUtils";

/** Пункт списку разом із вмістом своєї пісні — так його віддає ендпоінт. */
export type GatheringPoint = ListPoint & { slate?: Descendant[] | null };

interface BaseItem {
  /**
   * Ключ пункту — той самий, що й у списку: потрібен лише рендеру.
   *
   * Тотожність пункту для ПЛЕЙБЕКУ — це його місце в служінні (`p0`, `p1`, …),
   * а не цей ключ: ключ у кожного пристрою свій (він народжується на межі з
   * сервером), а порядок однаковий у всіх. Тому по мережі їде місце.
   */
  key: string;
  /**
   * Місце пункту в служінні (`p0`, `p1`, …) — те саме, що їде по мережі
   * попереду ключів токенів (див. `unprefixTokenKey`, там і причина).
   * Без нього показ не має чим відрізнити свою голку від чужої.
   *
   * Стоїть на КОЖНОМУ пункті, включно з примітками, хоч у примітки токенів і
   * не буває: ряд лишається однорідним, і показу не треба питати, якого виду
   * пункт, перш ніж спитати про голку.
   */
  tokenKeyPrefix: string;
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
 * Примітка, що звучить, — програш. НЕ третій вид пункту (їх два, `LIST-24`):
 * той самий пункт-примітка, лише показує себе документом, а не рядком.
 */
export interface GatheringSoundingItem extends BaseItem {
  kind: "sounding";
  point: NotePoint;
  text: string;
  /** Згенерований документ програша — показується так само, як пісня. */
  nodes: Descendant[];
}

export type GatheringItem = GatheringSongItem | GatheringNoteItem | GatheringSoundingItem;

/** Де в служінні звучить цей токен: сегмент черги плюс зсув у ньому. */
export interface TokenPosition {
  /** Індекс сегмента в наскрізній черзі. */
  segmentIndex: number;
  segmentId: string;
  /** Зсув від початку сегмента в імпульсах. */
  beats: number;
}

export interface Gathering {
  items: GatheringItem[];
  segments: PlaybackSegment[];
  /** Ключ — токен із префіксом пункту, як він їде по мережі. */
  tokens: Map<string, TokenPosition>;
}

/** Усе, що зібранню треба знати про пісню. Читається з документа один раз. */
interface SongContext {
  bpm: number;
  timeSignature: [number, number];
  key: SongKeyValue;
  progression: ChordEvent[];
}

const readSong = (nodes: Descendant[] | null | undefined): SongContext => {
  const safe = Array.isArray(nodes) ? nodes : [];
  const { bpm, timeSignature, key } = extractHeader(safe);
  const { progression } = getProgressionFromSlate({ nodes: safe, bpm, timeSignature }, null);
  return { bpm, timeSignature, key, progression };
};

// ─── Акорди програша ────────────────────────────────────────────────────────

/**
 * Ступінь тональності як назва акорда; `semitones` — скільки півтонів угору
 * від тоніки. Пишеться дієзами, бо дієзами записані самі тональності
 * (`keyUtils.keys`): у бемольній пісні луп прозвучить правильно, а виглядатиме
 * енгармонічно (`Eb` → `D#`).
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

// ─── Збірка ─────────────────────────────────────────────────────────────────

/** Частина програша до того, як вона стала сегментом і рядком документа. */
interface SoundingPart {
  suffix: "intro" | "loop" | "outro";
  text: string;
  kind: "once" | "loop";
  bpm: number;
  timeSignature: [number, number];
  rampTempo?: boolean;
}

/**
 * Три частини програша: вступ у старому, луп у новому, вихід у першу пісню.
 * Відсутня частина означає, що з того боку сусіда немає, — і цей шов є тишею.
 */
const soundingParts = (prev: SongContext | null, next: SongContext | null): SoundingPart[] => {
  // Луп живе в тональності, розмірі й темпі НАСТУПНОЇ пісні: він веде саме в
  // неї. Немає наступної — лишаємось там, звідки прийшли; немає жодної —
  // програш усе одно звучить, просто в дефолтних (`LIST-39`).
  const home = next ?? prev;
  const key = home?.key ?? "C";
  const timeSignature = home?.timeSignature ?? DEFAULT_TIME_SIGNATURE;
  const bpm = home?.bpm ?? DEFAULT_BPM;

  const parts: SoundingPart[] = [];

  if (prev) {
    // Вступ — хвіст попередньої пісні: її тональність, розмір і темп. Усе нове
    // починається аж на межі вступ→луп (ADR-0002).
    const departure = lastSoundingChord(prev.progression);
    parts.push({
      suffix: "intro",
      text: barsOf([...(departure ? [departure] : []), dominantSeventh(key)]),
      kind: "once",
      bpm: prev.bpm,
      timeSignature: prev.timeSignature,
    });
  }

  parts.push({
    suffix: "loop",
    text: barsOf([tonic(key), subdominant(key)]),
    kind: "loop",
    bpm,
    timeSignature,
    // Рампити нема ВІД чого без вступу, нема КУДИ без наступної пісні (луп
    // лишається в темпі попередньої), і нема ЧИМ при різних знаменниках: BPM
    // рахує імпульси, а імпульс у 4/4 і в 6/8 — різні одиниці (ADR-0002).
    rampTempo:
      prev != null && next != null && canRampBetween(prev.timeSignature, timeSignature),
  });

  // Пісня, у якій не звучить жоден акорд (немає розмічених тактів), — така
  // сама тиша, як і відсутній сусід: приходити нема в що, тож виходу немає.
  const arrival = next ? firstSoundingChord(next.progression) : null;
  if (arrival) {
    parts.push({
      suffix: "outro",
      text: barsOf([arrival]),
      kind: "once",
      bpm,
      timeSignature,
    });
  }

  return parts;
};

/** Документ програша: текст примітки заголовком секції, під ним акорди. */
const soundingNodes = (text: string, parts: SoundingPart[]): Descendant[] =>
  [
    {
      type: "section",
      children: [
        { type: "line", children: [{ text }] },
        ...parts.map((part) => ({ type: "chord-line", children: [{ text: part.text }] })),
      ],
    },
  ] as unknown as Descendant[];

/**
 * «Грай звідси й до кінця служіння» (`LIST-43`): черга від першого сегмента
 * названого пункту й далі без змін.
 *
 * Невідомий пункт означає, що в того, хто ріже чергу, ІНШИЙ список — знімок
 * старіший або новіший за той, з якого тиснули. Тоді не грає нічого: почати з
 * початку служіння посеред зібрання гірше за тишу, з якої видно, що команда не
 * вийшла.
 */
export const sliceFromPoint = (
  segments: ReadonlyArray<PlaybackSegment>,
  fromPoint: string,
): PlaybackSegment[] => {
  const start = segments.findIndex((segment) => pointOfSegment(segment) === fromPoint);
  return start < 0 ? [] : segments.slice(start);
};

export function buildGathering(points: ReadonlyArray<GatheringPoint>): Gathering {
  const numbers = numberSongs(points);
  const songs = points.map((point) =>
    point.kind === "song" ? readSong(point.slate) : null,
  );

  const items: GatheringItem[] = [];
  const segments: PlaybackSegment[] = [];

  points.forEach((point, index) => {
    const tokenPrefix = pointPrefix(index);

    if (point.kind === "song") {
      const song = songs[index]!;
      items.push({
        kind: "song",
        key: point.key,
        tokenKeyPrefix: tokenPrefix,
        point,
        number: numbers[index]!,
        nodes: Array.isArray(point.slate) ? point.slate : [],
      });
      segments.push({
        id: tokenPrefix,
        tokenKeyPrefix: tokenPrefix,
        progression: song.progression,
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        kind: "once",
      });
      return;
    }

    // Сусід — лише пункт поруч, і лише пісня: примітка між ними означає
    // зупинку, тобто тишу на цьому шві.
    const prev = songs[index - 1] ?? null;
    const next = songs[index + 1] ?? null;

    if (!point.sounding) {
      items.push({
        kind: "note",
        key: point.key,
        tokenKeyPrefix: tokenPrefix,
        point,
        text: point.text,
      });
      // Пауза не звучить, але темп і розмір у неї є: транспорт має з чим стати
      // й чим піти далі. Беремо в найближчої пісні — своїх у тиші не буває.
      const near = prev ?? next;
      segments.push({
        id: `${tokenPrefix}:pause`,
        progression: [],
        bpm: near?.bpm ?? DEFAULT_BPM,
        timeSignature: near?.timeSignature ?? DEFAULT_TIME_SIGNATURE,
        kind: "pause",
      });
      return;
    }

    const parts = soundingParts(prev, next);
    items.push({
      kind: "sounding",
      key: point.key,
      tokenKeyPrefix: tokenPrefix,
      point,
      text: point.text,
      nodes: soundingNodes(point.text, parts),
    });

    parts.forEach((part, partIndex) => {
      segments.push({
        id: `${tokenPrefix}:${part.suffix}`,
        tokenKeyPrefix: tokenPrefix,
        // Кожна частина — свій рядок документа, тож лексується своїм номером
        // рядка й СВОЇМ розміром: вступ ще в старому, луп уже в новому.
        progression: chordLineToProgressionMapWithKeys(
          part.text,
          0,
          partIndex,
          part.timeSignature[0],
        ),
        bpm: part.bpm,
        timeSignature: part.timeSignature,
        kind: part.kind,
        ...(part.rampTempo === undefined ? {} : { rampTempo: part.rampTempo }),
      });
    });
  });

  return { items, segments, tokens: mapTokens(segments) };
}

/**
 * Токен → де він звучить уперше.
 *
 * Саме вперше: секція з повтором дає той самий ключ кілька разів, а «грай
 * звідси» означає початок, а не другий прохід.
 */
const mapTokens = (segments: PlaybackSegment[]): Map<string, TokenPosition> => {
  const tokens = new Map<string, TokenPosition>();

  segments.forEach((segment, segmentIndex) => {
    let beats = 0;
    for (const event of segment.progression) {
      const key = prefixTokenKey(event.tokenKey ?? null, segment.tokenKeyPrefix);
      if (key != null && !tokens.has(key)) {
        tokens.set(key, { segmentIndex, segmentId: segment.id, beats });
      }
      beats += Math.max(0, event.duration || 0);
    }
  });

  return tokens;
};
