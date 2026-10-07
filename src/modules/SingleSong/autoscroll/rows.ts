import { Element, type Descendant, type Path } from "slate";

/**
 * Рядок пісні в сенсі автоскролу (`SCROLL-15`): один або два вузли документа.
 * Два — це акорди й слова під ними, які звучать разом. Заголовок секції
 * (`SONG-8`) окремого правила не має: підпис «Приспів:» — рядок слів сам по
 * собі, а секція без підпису починається звичайним рядком.
 *
 * Номер рядка — його індекс у масиві з `songRows`. Він однаковий для всіх:
 * рахуємо по документу, а не по показу, тож фільтри, згортання й капо його не
 * чіпають (`SCROLL-16`), а повтори секції ігноруємо свідомо (ADR-0005).
 */
export type SongRow = Path[];

/**
 * Рядок секції: слова або акорди. Старий вузол-якір примітки рядком не є, а
 * порожніх рядків усередині секції не буває — нормалізація виносить їх межею
 * між секціями (`withSections`). Те саме правило, що в показі
 * (`display/operations.ts`), тож заголовок секції — один і той самий вузол.
 */
const isContentRow = (node: Descendant): node is Element =>
  Element.isElement(node) && (node.type === "line" || node.type === "chord-line");

/** Усі рядки пісні по порядку. */
export const songRows = (children: Descendant[]): SongRow[] => {
  const rows: SongRow[] = [];

  children.forEach((section, s) => {
    if (!Element.isElement(section) || section.type !== "section") return;

    // Акорди, що чекають, чи не підуть під ними слова.
    let pendingChords: Path | null = null;

    section.children.forEach((node, i) => {
      if (!isContentRow(node)) return;
      const path = [s, i];

      if (node.type === "chord-line") {
        if (pendingChords) rows.push([pendingChords]);
        pendingChords = path;
        return;
      }

      rows.push(pendingChords ? [pendingChords, path] : [path]);
      pendingChords = null;
    });

    if (pendingChords) rows.push([pendingChords]);
  });

  return rows;
};
