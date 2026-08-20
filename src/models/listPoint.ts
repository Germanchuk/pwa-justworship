/**
 * ПУНКТИ СПИСКУ СЛУЖІННЯ — точка розуміння.
 *
 * Список — це **впорядкована послідовність пунктів різного типу**, а не набір
 * пісень. Це те, з чого складається служіння: між піснями стоїть рядок для
 * гурту або програш, що звучить, поки говорить ведучий.
 *
 * ─── ДВА ТИПИ, А НЕ ТРИ ────────────────────────────────────────────────────
 *   song — посилання на пісню гурту. Пісня живе у своєму документі; список її
 *          не копіює й не володіє нею.
 *   note — рядок тексту для гурту («після цієї — молитва»). Належить ЛИШЕ
 *          цьому списку.
 *
 * Програш — **не третій тип, а примітка, що звучить** (`sounding`). Звідси
 * одне правило замість трьох: у зібранні будь-яка примітка зупиняє звук, і
 * різниця лише в тому, чи крутиться під неї луп. Кнопок у правці все одно
 * дві — вони описують намір, а не тип.
 *
 * ─── ЧОМУ ПРОГРАШ НІЧОГО НЕ ЗБЕРІГАЄ ───────────────────────────────────────
 * Програш **не має власного вмісту**: акорди рахуються на льоту з тональностей,
 * розмірів і темпів сусідніх пісень. Інакше зміна тональності пісні через
 * місяць лишила б програш, який веде не туди. Зберігається лише його текст —
 * той, що видно в списку й що стає заголовком секції, поки програш звучить.
 *
 * ─── МЕЖА З СЕРВЕРОМ ───────────────────────────────────────────────────────
 * На сервері це **динамічна зона** Strapi: кожен пункт приїжджає з
 * `__component`, а пісня — вкладеною реляцією. Ця форма зручна серверу й
 * незручна екранам, тож вона лишається на межі: `fromApi` / `toApi` нижче —
 * єдине місце, що про неї знає. Далі по застосунку ходить union.
 *
 * Форма ОДНА. Старий окремий компонент програша був другою, поки не переїхали
 * середовища (тікет `02`); зі схеми його знято, і гілка під нього — теж.
 */

export type ListPointKind = "song" | "note";

interface BasePoint {
  /**
   * Ключ для рендера й перетягування. Живе лише в пам'яті екрана: пункти
   * зберігаються повною заміною зони, тож стабільний id їм не потрібен.
   *
   * Свідомо НЕ id пісні: та сама пісня може стояти в служінні двічі
   * (реприза), і однакові ключі зламали б перетягування — тихо й неочевидно.
   */
  key: string;
}

export interface SongPoint extends BasePoint {
  kind: "song";
  songId: number | string;
  /**
   * Знімок того, що пункт показує про свою пісню. Не копія даних, а результат
   * populate: назва, тональність і темп живуть у самій пісні, і перейменування
   * підхоплюється саме собою при наступному читанні.
   */
  name: string;
  songKey?: string | null;
  bpm?: number | null;
}

export interface NotePoint extends BasePoint {
  kind: "note";
  /** Примітка не буває порожньою — ні у формі, ні на сервері. */
  text: string;
  /** Ознака «звучить»: під цю примітку в зібранні крутиться програш. */
  sounding: boolean;
}

export type ListPoint = SongPoint | NotePoint;

/** Рядок-примітка — це рядок, а не абзац. Те саме число перевіряє схема. */
export const NOTE_MAX_LENGTH = 200;

/**
 * Типовий текст програша. Підпис тут потрібен не менше, ніж у звичайної
 * примітки: у зібранні він стає заголовком секції, під якою йдуть акорди.
 */
export const SOUNDING_NOTE_TEXT = "Програш";

const COMPONENT = {
  song: "list.song-point",
  note: "list.note-point",
} as const satisfies Record<ListPointKind, string>;

const newKey = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const makeSongPoint = (song: { id: number | string; name?: string }): SongPoint => ({
  kind: "song",
  key: newKey(),
  songId: song.id,
  name: song.name ?? "",
});

export const makeNotePoint = (text = ""): NotePoint => ({
  kind: "note",
  key: newKey(),
  text,
  sounding: false,
});

/**
 * Примітка, додана кнопкою «додати програш»: одразу з ознакою й одразу з
 * текстом. Порожнього підпису тут не буває — вигадувати його там, де він не
 * потрібен, нікому не хочеться, а рядок без тексту в порядку служіння виглядає
 * як помилка.
 */
export const makeSoundingNote = (): NotePoint => ({
  kind: "note",
  key: newKey(),
  text: SOUNDING_NOTE_TEXT,
  sounding: true,
});

/**
 * Strapi віддає реляцію у двох формах залежно від того, звідки читали:
 * `entityService` — плоским об'єктом, REST-колекції — загорнутою в
 * `{ data: { id, attributes } }`. Розгортаємо обидві тут, щоб екрани про цю
 * різницю не знали.
 */
const unwrapSong = (
  raw: any
): { id: number | string; name: string; songKey: string | null; bpm: number | null } | null => {
  const node = raw?.data ?? raw;
  if (!node?.id) return null;
  const fields = node.attributes ?? node;
  return {
    id: node.id,
    name: fields.name ?? "",
    songKey: fields.key ?? null,
    bpm: fields.bpm ?? null,
  };
};

/** Динамічна зона з сервера → union, яким користуються екрани. */
export const fromApi = (raw: unknown): ListPoint[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item: any): ListPoint[] => {
    switch (item?.__component) {
      case COMPONENT.song: {
        const song = unwrapSong(item.song);
        // Пісню видалили з бібліотеки — реляція занулилась. Сервер такі пункти
        // відсіює, але клієнт не мусить на це покладатись: порожній рядок у
        // порядку служіння гірший за його відсутність.
        if (!song) return [];
        return [
          {
            kind: "song",
            key: newKey(),
            songId: song.id,
            name: song.name,
            songKey: song.songKey,
            bpm: song.bpm,
          },
        ];
      }
      case COMPONENT.note: {
        // Порожня примітка — те саме, що пісенний пункт без пісні: рядок, який
        // нічого не каже. Схема такої вже не приймає, але в базі могли лишитись
        // старі, і показувати їх на служінні нема за що.
        const text = (item.text ?? "").trim();
        if (!text) return [];
        return [{ kind: "note", key: newKey(), text, sounding: Boolean(item.sounding) }];
      }
      default:
        return [];
    }
  });
};

/**
 * Пункти, готові до збереження: недописані примітки з порядку зникають.
 *
 * Правило тут одне на весь застосунок — на сервері текст примітки
 * обов'язковий, тож один порожній рядок інакше завалив би збереження всього
 * списку. Екран правки прибирає такі пункти зі свого стану ЦИМ ЖЕ хелпером:
 * інакше після збереження він показував би рядок, якого на сервері немає.
 */
export const dropEmptyNotes = (points: ReadonlyArray<ListPoint>): ListPoint[] =>
  points.flatMap((point): ListPoint[] =>
    point.kind === "note"
      ? point.text.trim()
        ? [{ ...point, text: point.text.trim() }]
        : []
      : [point]
  );

/**
 * Union → динамічна зона для запису.
 *
 * Id компонентів свідомо НЕ шлемо: зона зберігається повною заміною. Пункт не
 * має власної тотожності поза своїм місцем у порядку, тож зшивати старі й нові
 * рядки нема заради чого — а спроба це робити зазвичай і породжує баги
 * впорядкування.
 *
 * Порожні примітки сюди не потрапляють — див. `dropEmptyNotes`.
 */
export const toApi = (points: ReadonlyArray<ListPoint>): unknown[] =>
  dropEmptyNotes(points).map((point): unknown => {
    switch (point.kind) {
      case "song":
        return { __component: COMPONENT.song, song: point.songId };
      case "note":
        return { __component: COMPONENT.note, text: point.text, sounding: point.sounding };
    }
  });

/** Лише пісні, у порядку списку — для екранів, що мислять піснями. */
export const songPointsOf = (points: ReadonlyArray<ListPoint>): SongPoint[] =>
  points.filter((point): point is SongPoint => point.kind === "song");

/**
 * Наскрізна нумерація ПІСЕНЬ, а не пунктів: на репетиції домовляються
 * «давай з третьої», маючи на увазі третю пісню, і примітка між ними цього
 * рахунку збивати не повинна. `null` — пункт, який у рахунок не входить.
 */
export const numberSongs = (points: ReadonlyArray<ListPoint>): (number | null)[] => {
  let songNumber = 0;
  return points.map((point) => (point.kind === "song" ? ++songNumber : null));
};
