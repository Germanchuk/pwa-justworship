/**
 * Slate-трансформації транспозиції — реалізація контрактів з `model.ts`.
 *
 *   relabelKey         — РЕЖИМ 1: лише ярлик тональності.
 *   changePlayingKey   — РЕЖИМ 2: перетонувати всі акорди + ярлик (деструктивно).
 *   setCapo            — РЕЖИМ 3: per-user капо (той самий мутатор, що в Capo.tsx).
 *   resolveTransposition — обчислити стан транспозиції для користувача.
 */

import { Editor, Node, Path, Transforms } from "slate";

import type { CapoElement, SongKeyElement } from "../types";
import { keyForCapo, transposeChordText } from "./transposeChords";
import type {
  ChangePlayingKey,
  RelabelKey,
  ResolveTransposition,
  SetCapo,
  SetCapoEnabled,
  SongKeyValue,
} from "./model";

type Found<T> = [T, Path];

/** Перший елемент заданого типу в документі (з його шляхом). */
function findFirst<T>(editor: Editor, type: string): Found<T> | null {
  for (const [node, path] of Node.elements(editor)) {
    if ((node as { type?: string }).type === type) {
      return [node as unknown as T, path];
    }
  }
  return null;
}

/** Усі chord-line елементи документа (зі шляхами). */
function findChordLines(editor: Editor): Found<Node>[] {
  const out: Found<Node>[] = [];
  for (const [node, path] of Node.elements(editor)) {
    if ((node as { type?: string }).type === "chord-line") {
      out.push([node, path]);
    }
  }
  return out;
}

/** Замінити весь текст блока на `newText`, лишивши сам блок. */
function replaceBlockText(editor: Editor, blockPath: Path, newText: string): void {
  const start = Editor.start(editor, blockPath);
  const end = Editor.end(editor, blockPath);
  Transforms.delete(editor, { at: { anchor: start, focus: end } });
  Transforms.insertText(editor, newText, { at: start });
}

/** РЕЖИМ 1 — змінити лише ярлик тональності (акорди не чіпаємо). */
export const relabelKey: RelabelKey = (editor, newKey) => {
  const entry = findFirst<SongKeyElement>(editor, "song-key");
  if (!entry) return;
  Transforms.setNodes<SongKeyElement>(
    editor,
    { keyValue: newKey },
    { at: entry[1] },
  );
};

/** РЕЖИМ 2 — перетонувати всі акорди у нову тональність + оновити ярлик. */
export const changePlayingKey: ChangePlayingKey = (editor, toKey) => {
  const songKeyEntry = findFirst<SongKeyElement>(editor, "song-key");
  const fromKey = (songKeyEntry?.[0].keyValue ?? "C") as SongKeyValue;
  if (fromKey === toKey) return;

  // Збираємо рядки наперед: правки тексту не зсувають шляхи інших блоків.
  const lines = findChordLines(editor);

  Editor.withoutNormalizing(editor, () => {
    for (const [node, path] of lines) {
      const oldText = Node.string(node);
      if (!oldText) continue;
      const newText = transposeChordText(oldText, fromKey, toKey);
      if (newText === oldText) continue;
      replaceBlockText(editor, path, newText);
    }
    if (songKeyEntry) {
      Transforms.setNodes<SongKeyElement>(
        editor,
        { keyValue: toKey },
        { at: songKeyEntry[1] },
      );
    }
  });
};

/** РЕЖИМ 3 — per-user капо. semitones = 0 знімає капо для цього користувача. */
export const setCapo: SetCapo = (editor, username, semitones) => {
  if (!username) return;
  const entry = findFirst<CapoElement>(editor, "capo");
  if (!entry) return;
  const [capo, path] = entry;

  const nextValuesBy = { ...(capo.valuesBy ?? {}) };
  if (!semitones) {
    delete nextValuesBy[username];
  } else {
    nextValuesBy[username] = semitones;
  }
  // Виставлення значення завжди вмикає капо для цього користувача.
  const nextDisabled = (capo.disabledFor ?? []).filter((u) => u !== username);

  Transforms.setNodes<CapoElement>(
    editor,
    { valuesBy: nextValuesBy, disabledFor: nextDisabled },
    { at: path },
  );
};

/** Power-toggle: тимчасово ввімкнути/вимкнути капо, не втрачаючи його значення. */
export const setCapoEnabled: SetCapoEnabled = (editor, username, enabled) => {
  if (!username) return;
  const entry = findFirst<CapoElement>(editor, "capo");
  if (!entry) return;
  const [capo, path] = entry;

  const current = capo.disabledFor ?? [];
  const isDisabled = current.includes(username);
  if (enabled === !isDisabled) return; // нічого не змінюється

  const nextDisabled = enabled
    ? current.filter((u) => u !== username)
    : [...current, username];
  Transforms.setNodes<CapoElement>(editor, { disabledFor: nextDisabled }, { at: path });
};

/** Обчислити стан транспозиції для конкретного користувача. */
export const resolveTransposition: ResolveTransposition = (editor, username) => {
  const songKey = (findFirst<SongKeyElement>(editor, "song-key")?.[0].keyValue ??
    "C") as SongKeyValue;

  const capoNode = findFirst<CapoElement>(editor, "capo")?.[0];
  const rawCapo = (username && capoNode?.valuesBy?.[username]) || 0;
  const disabled = !!username && !!capoNode?.disabledFor?.includes(username);
  const myCapo = disabled ? 0 : rawCapo;

  return {
    songKey,
    myCapo,
    effectiveKey: keyForCapo(songKey, myCapo),
  };
};
