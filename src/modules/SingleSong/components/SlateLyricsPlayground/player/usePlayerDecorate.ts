import {useCallback, useContext} from "react";
import {Editor, Element, Node, type NodeEntry, type Range} from "slate";
// useSlate (НЕ useSlateStatic): щоб хук перемальовувався на кожну зміну
// документа й декорація капо (`displayChord`) оновлювалась МОМЕНТАЛЬНО при
// ввімкненні/вимкненні капо, а не на наступному ре-рендері з іншої причини.
import {useSlate} from "slate-react";

import {isChord} from "#utils/keyUtils";
import {
  findBarDivisionIssues,
  findSilentTails,
  isPlayableChordLine,
  tokenizeChordLine,
} from "../../../services/ChordsProgressionPlayer/getMidiFromSections/utils/chordLineToProgressionMapWithKeys";
import {SILENCE_MARK} from "#utils/chordSyntax";
import {extractHeader} from "../../../services/ChordsProgressionPlayer/extractHeader";
import {useCanEditContent} from "../../../mode";
import {transposeChordTextForCapo} from "../transposition/transposeChords";
import {useTransposition} from "../transposition/useTransposition";
import {PlayerHighlightContext} from "./PlayerHighlightContext";

const SEPARATORS = new Set(["|", "."]);

/**
 * Given a chord-line path, returns its `sectionIndex` (among root `section` children,
 * skipping song-name / song-meta-row) and `chordLineIndex` (index among `chord-line`
 * elements within the parent section, skipping `comment-anchor`s and other types).
 */
const findIndices = (
  editor: Editor,
  path: number[],
): {sectionIndex: number; chordLineIndex: number} | null => {
  if (path.length !== 2) return null;
  const [rootIdx, lineIdx] = path;

  let sectionIndex = -1;
  for (let i = 0; i <= rootIdx; i++) {
    const n = editor.children[i];
    if (Element.isElement(n) && (n as {type?: string}).type === "section") {
      sectionIndex += 1;
    }
  }
  const sectionNode = editor.children[rootIdx];
  if (!sectionNode || !Element.isElement(sectionNode)) return null;
  if ((sectionNode as {type?: string}).type !== "section") return null;

  let chordLineIndex = -1;
  const kids = (sectionNode as {children?: unknown[]}).children ?? [];
  for (let i = 0; i <= lineIdx && i < kids.length; i++) {
    const k = kids[i];
    if (Element.isElement(k) && (k as {type?: string}).type === "chord-line") {
      chordLineIndex += 1;
    }
  }
  if (chordLineIndex < 0) return null;
  return {sectionIndex, chordLineIndex};
};

/**
 * Map a character offset within a chord-line's concatenated text back to a
 * Slate point `{path, offset}`. Walks the flat array of text-leaf children.
 */
const offsetToPoint = (
  linePath: number[],
  children: {text: string}[],
  offset: number,
): {path: number[]; offset: number} => {
  let remaining = offset;
  for (let i = 0; i < children.length; i++) {
    const len = children[i].text.length;
    if (remaining <= len) {
      return {path: [...linePath, i], offset: remaining};
    }
    remaining -= len;
  }
  // Clamp to end of last child.
  const lastIdx = Math.max(0, children.length - 1);
  return {
    path: [...linePath, lastIdx],
    offset: children[lastIdx]?.text.length ?? 0,
  };
};

export const usePlayerDecorate = () => {
  const editor = useSlate();
  const {currentTokenKey, selectedTokenKey} = useContext(PlayerHighlightContext);

  // Per-user капо: показуємо транспоновані акорди капо-юзеру. Поза читанням
  // капо не діє (`useTransposition` віддає myCapo=0): правки летять у
  // документ у спільній тональності, а виділення під примітку не з'їжджає
  // через різницю довжин показаного й документного акорду.
  const {songKey, myCapo} = useTransposition();
  const capoActive = myCapo > 0;

  // Нечистий поділ такту — підказка авторові, а не інформація для гурту:
  // читач її не виправить, а рядок вона засмічує. Тому лише в режимі правки.
  const showBarIssues = useCanEditContent();
  const pulsesPerBar = extractHeader(editor.children).timeSignature[0];

  return useCallback(
    (entry: NodeEntry): Range[] => {
      const [node, path] = entry;
      if (!Element.isElement(node)) return [];
      if ((node as {type?: string}).type !== "chord-line") return [];

      const idx = findIndices(editor, path);
      if (!idx) return [];

      const text = Node.string(node);
      if (!text) return [];
      const tokens = tokenizeChordLine(text);
      if (tokens.length === 0) return [];

      // Slate Editable wraps non-text children, but chord-line schema is flat CustomText[].
      const children = (node as {children: {text: string}[]}).children ?? [];
      const playable = isPlayableChordLine(text);

      const ranges: Range[] = [];

      // Такти, поділені нечисто: підкреслюємо такт **цілком**, від риски до
      // риски. Помилка стосується всього такту, а не тієї риски, біля якої її
      // помітили, — і по підкресленню одразу видно межі проблемного місця.
      if (showBarIssues && playable) {
        for (const bar of findBarDivisionIssues(text, pulsesPerBar)) {
          ranges.push({
            anchor: offsetToPoint(path, children, bar.charStart),
            focus: offsetToPoint(path, children, bar.charEnd),
            barInvalid: true,
          } as unknown as Range);
        }

      }

      // Хвіст після `!` не звучить — глушимо його в усіх режимах, бо це не
      // помилка автора, а факт про пісню: гурт теж має бачити, де такт стих.
      // Ці слоти акордами плеєра не стають, навіть якщо там написано акорд.
      const silent = new Set<number>();
      if (playable) {
        for (const tk of findSilentTails(text, pulsesPerBar)) {
          silent.add(tk.charStart);
          ranges.push({
            anchor: offsetToPoint(path, children, tk.charStart),
            focus: offsetToPoint(path, children, tk.charEnd),
            barMark: true,
          } as unknown as Range);
        }
      }

      for (const tk of tokens) {
        if (SEPARATORS.has(tk.token)) continue;
        if (silent.has(tk.charStart)) continue;

        const anchor = offsetToPoint(path, children, tk.charStart);
        const focus = offsetToPoint(path, children, tk.charEnd);

        // Тиша — не «нерозпізнаний акорд»: вона займає долю свідомо, тож
        // червоне підкреслення тут було б звинуваченням на порожньому місці.
        // Токеном плеєра лишається: під час гри видно, як тиша проходить.
        // Капо її, певна річ, не транспонує — транспонувати нема чого.
        const isSilence = tk.token === SILENCE_MARK;
        const isValid = isChord(tk.token);
        const displayChord =
          capoActive && isValid
            ? transposeChordTextForCapo(tk.token, songKey, myCapo)
            : undefined;

        // Рядок без тактових рисок синтаксису не заявляє — це просто акорди
        // над словами (`SONG-18`), і судити його нема за чим: не підкреслюємо
        // нічого. Діапазон усе одно віддаємо — на ньому їде показ капо.
        //
        // А от рядок, який риски має, але не закритий, синтаксис заявив і не
        // витримав: там підкреслення доречне. Токеном плеєра він не стає в
        // жодному разі — у прогресію такий рядок не потрапляє.
        if (!playable) {
          const attemptsSyntax = text.includes("|");
          ranges.push({
            anchor,
            focus,
            ...(attemptsSyntax ? {chordInvalid: true} : {}),
            ...(displayChord ? {displayChord} : {}),
          } as unknown as Range);
          continue;
        }

        const tokenKey = `${idx.sectionIndex}:${idx.chordLineIndex}:${tk.tokenIndex}`;

        ranges.push({
          anchor,
          focus,
          chordToken: true,
          chordTokenKey: tokenKey,
          chordPlayingNow: tokenKey === currentTokenKey,
          chordSelected: tokenKey === selectedTokenKey,
          chordInvalid: !isValid && !isSilence,
          ...(isSilence ? {chordSilence: true} : {}),
          ...(displayChord ? {displayChord} : {}),
        } as unknown as Range);
      }

      return ranges;
    },
    [
      editor,
      currentTokenKey,
      selectedTokenKey,
      capoActive,
      songKey,
      myCapo,
      showBarIssues,
      pulsesPerBar,
    ],
  );
};
