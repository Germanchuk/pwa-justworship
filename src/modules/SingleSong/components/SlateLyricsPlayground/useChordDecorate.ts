import {useCallback} from "react";
import {Element, Node, type NodeEntry, type Range} from "slate";
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
} from "../../services/songChords/chordLineToProgressionMapWithKeys";
import {SILENCE_MARK} from "#utils/chordSyntax";
import {extractHeader} from "../../services/songChords/extractHeader";
import {useCanEditContent} from "../../mode";
import {transposeChordTextForCapo} from "./transposition/transposeChords";
import {useTransposition} from "./transposition/useTransposition";

const SEPARATORS = new Set(["|", "."]);

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

/**
 * Декорація акордових рядків: показ капо, позначки синтаксису такту й тиші.
 * Нічого з цього не пишеться в документ.
 */
export const useChordDecorate = () => {
  const editor = useSlate();

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
        // витримав: там підкреслення доречне.
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

        ranges.push({
          anchor,
          focus,
          chordToken: true,
          chordInvalid: !isValid && !isSilence,
          ...(isSilence ? {chordSilence: true} : {}),
          ...(displayChord ? {displayChord} : {}),
        } as unknown as Range);
      }

      return ranges;
    },
    [capoActive, songKey, myCapo, showBarIssues, pulsesPerBar],
  );
};
