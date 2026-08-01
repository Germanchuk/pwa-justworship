/**
 * Експорт пісні у .docx з живого Slate-документа.
 *
 * Джерело даних — `editor.children` (структура описана в
 * `../components/SlateLyricsPlayground/types.ts`):
 *
 *   [0]    song-name
 *   [1]    song-meta-row → bpm | time-signature | song-key (keyValue) | capo
 *   [2…]   section (діти: line | chord-line | comment-anchor) та empty-line
 *
 * Свідомо НЕ експортуємо:
 *   - `comment-anchor` — void-вузли коментарів (per-user, приватні);
 *   - per-user поля `section.collapsedFor`, `capo.valuesBy`, `capo.disabledFor`
 *     (той самий перелік приватного, що вирізає `sanitizeSnapshot` у
 *     `collab-justworship/src/slateBridge.ts`).
 */

import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { Element, Node, type Descendant, type Editor } from "slate";

import type {
  ChordLineElement,
  SectionElement,
} from "#modules/SingleSong/components/SlateLyricsPlayground/types";
import { resolveTransposition } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/operations";
import {
  keyDisplayName,
  transposeChordTextForCapo,
} from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";

/**
 * Шрифт акорд-рядків. Моноширинний — щоб провідні пробіли (а отже й позиція
 * акорда над складом) не «попливли».
 *
 * УВАГА: справжнє вирівнювання «акорд над складом» працює лише тоді, коли
 * ОБИДВА рядки моноширинні. Зараз текст пісні лишається пропорційним (Arial) —
 * так виглядає ближче до звичайного документа. Якщо захочеться точного
 * вирівнювання, як у редакторі, достатньо зробити `LYRIC_FONT = CHORD_FONT`.
 */
const CHORD_FONT = "Courier New";
const LYRIC_FONT = "Arial";

const CHORD_COLOR = "ff5733";

type ElementNode = Element & { type?: string };

const isType = (node: Descendant, type: string): boolean =>
  Element.isElement(node) && (node as ElementNode).type === type;

const findChild = (parent: Descendant | undefined, type: string): Descendant | undefined => {
  if (!parent || !Element.isElement(parent)) return undefined;
  return (parent as ElementNode).children.find((child) => isType(child, type));
};

interface SongHeaderData {
  name: string;
  bpm: string;
  /** Тональність, яку бачить саме цей користувач (з урахуванням капо). */
  keyLabel: string;
  /** Капо поточного користувача в півтонах; 0 — немає. */
  capo: number;
}

function extractHeader(editor: Editor, username: string | undefined): SongHeaderData {
  const nodes = editor.children as Descendant[];

  const nameNode = nodes.find((n) => isType(n, "song-name"));
  const metaRow = nodes.find((n) => isType(n, "song-meta-row"));

  const bpmNode = findChild(metaRow, "bpm");
  const { myCapo, effectiveKey } = resolveTransposition(editor, username);

  return {
    name: nameNode ? Node.string(nameNode).trim() : "",
    bpm: bpmNode ? Node.string(bpmNode).trim() : "",
    keyLabel: keyDisplayName(effectiveKey),
    capo: myCapo,
  };
}

/**
 * КАПО: експортуємо те, що людина БАЧИТЬ.
 *
 * У документі акорди зберігаються у спільній тональності (`song-key.keyValue`),
 * а капо-юзеру вони показуються транспонованими вниз на його капо (режим 3,
 * див. `transposition/model.ts`). Роздруківку людина бере, щоб грати саме зі
 * своїм капо — тож у .docx кладемо транспоновані акорди й підписуємо
 * тональність гри та «Капо: N», щоб файл не виглядав як інша пісня.
 * Без активного капо (myCapo = 0) це тотожність — акорди йдуть як є.
 */
function chordTextForExport(
  node: ChordLineElement,
  editor: Editor,
  username: string | undefined,
): string {
  const text = Node.string(node);
  const { songKey, myCapo } = resolveTransposition(editor, username);
  return transposeChordTextForCapo(text, songKey, myCapo);
}

function runForLine(text: string, isChordLine: boolean, isFirst: boolean): TextRun {
  return new TextRun({
    // Рядок з самих пробілів Word все одно згорне, тож порожні рядки всередині
    // секції лишаємо порожніми — розділювачем працює сам `break`.
    text,
    // `docx` віддає <w:t xml:space="preserve">, тож провідні пробіли акорд-рядка
    // доїжджають у файл без втрат.
    break: isFirst ? 0 : 1,
    font: isChordLine ? CHORD_FONT : LYRIC_FONT,
    bold: isChordLine || undefined,
    color: isChordLine ? CHORD_COLOR : undefined,
  });
}

/** Секція → один параграф (keepLines тримає її на одній сторінці). */
function sectionToParagraph(
  section: SectionElement,
  editor: Editor,
  username: string | undefined,
): Paragraph {
  const runs: TextRun[] = [];

  for (const child of section.children) {
    if (!Element.isElement(child)) continue;
    const type = (child as ElementNode).type;
    if (type === "comment-anchor") continue; // приватні коментарі — не в документ

    const isChordLine = type === "chord-line";
    const text = isChordLine
      ? chordTextForExport(child as ChordLineElement, editor, username)
      : Node.string(child);

    runs.push(runForLine(text, isChordLine, runs.length === 0));
  }

  return new Paragraph({ children: runs, keepLines: true, style: "sectionStyle" });
}

function bodyParagraphs(editor: Editor, username: string | undefined): Paragraph[] {
  const out: Paragraph[] = [];

  for (const node of editor.children as Descendant[]) {
    if (!Element.isElement(node)) continue;
    const type = (node as ElementNode).type;

    if (type === "section") {
      out.push(sectionToParagraph(node as SectionElement, editor, username));
    } else if (type === "empty-line") {
      // Порожні рядки між секціями лишаємо як розділювачі.
      out.push(new Paragraph({ text: "", style: "sectionStyle" }));
    }
    // song-name / song-meta-row вже пішли в заголовок, comment-anchor — приватний.
  }

  return out;
}

export function createDocument(editor: Editor | null, username?: string) {
  if (!editor) {
    console.warn("createDocument: немає активного Slate-редактора пісні");
    return;
  }

  const header = extractHeader(editor, username);

  const subtitleParts = [`Тональність: ${header.keyLabel}`];
  if (header.capo) subtitleParts.push(`Капо: ${header.capo}`);
  if (header.bpm) subtitleParts.push(`Темп: ${header.bpm}`);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: LYRIC_FONT,
          },
        },
      },
      paragraphStyles: [
        {
          id: "titleStyle",
          name: "Title Style",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            bold: true,
            size: 48, // 48 half-points = 24pt
          },
          paragraph: {
            alignment: "center",
          },
        },
        {
          id: "subtitleStyle",
          name: "Song Subtitle Style",
          basedOn: "Normal",
          next: "Normal",
          run: {
            size: 28, // 14pt
          },
          paragraph: {
            alignment: "center",
            spacing: { after: 200 },
          },
        },
        {
          id: "sectionStyle",
          name: "Song Section Style",
          basedOn: "Normal",
          next: "Normal",
          run: {
            size: 28, // 14pt
          },
          paragraph: {
            alignment: "left",
            // Відступ між секціями дають самі `empty-line` з документа —
            // подвоювати його ще й spacing не треба.
            spacing: { after: 0 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 567,
              right: 567,
              bottom: 567,
              left: 567,
            },
          },
        },
        children: [
          new Paragraph({
            text: header.name,
            style: "titleStyle",
          }),
          new Paragraph({
            text: subtitleParts.join(" | "),
            style: "subtitleStyle",
          }),
          ...bodyParagraphs(editor, username),
        ],
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    const fileName = header.name || "Пісня";
    saveAs(blob, `${fileName} (${header.keyLabel}).docx`);
  });
}
