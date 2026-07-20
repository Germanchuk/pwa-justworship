import {useCallback, useContext} from "react";
import {Editor, Element, Node, type NodeEntry, type Range} from "slate";
// useSlate (НЕ useSlateStatic): щоб хук перемальовувався на кожну зміну
// документа й декорація капо (`displayChord`) оновлювалась МОМЕНТАЛЬНО при
// ввімкненні/вимкненні капо, а не на наступному ре-рендері з іншої причини.
import {useSlate} from "slate-react";

import {isChord} from "#utils/keyUtils";
import {
  isPlayableChordLine,
  tokenizeChordLine,
} from "../../../services/ChordsProgressionPlayer/getMidiFromSections/utils/chordLineToProgressionMapWithKeys";
import {useCurrentUsername} from "../elements/hooks";
import {resolveTransposition} from "../transposition/operations";
import {transposeChordTextForCapo} from "../transposition/transposeChords";
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

  // Per-user капо (режим 3): показуємо транспоновані акорди капо-юзеру. Безпечно
  // й у редагованому в'юері, бо `withCapoGuard` блокує правки chord-line, поки
  // капо активне (немає поділу edit/view для основного сценарію).
  const username = useCurrentUsername();
  const {songKey, myCapo} = resolveTransposition(editor, username);
  const capoActive = myCapo > 0;

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
      for (const tk of tokens) {
        if (SEPARATORS.has(tk.token)) continue;

        const anchor = offsetToPoint(path, children, tk.charStart);
        const focus = offsetToPoint(path, children, tk.charEnd);

        const isValid = isChord(tk.token);
        const displayChord =
          capoActive && isValid
            ? transposeChordTextForCapo(tk.token, songKey, myCapo)
            : undefined;

        // Non-playable line (no bars → no duration semantics): underline every
        // chord token, but do not expose it as a clickable/highlightable token
        // — the player won't include it in the progression anyway.
        if (!playable) {
          ranges.push({
            anchor,
            focus,
            chordInvalid: true,
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
          chordInvalid: !isValid,
          ...(displayChord ? {displayChord} : {}),
        } as unknown as Range);
      }

      return ranges;
    },
    [editor, currentTokenKey, selectedTokenKey, capoActive, songKey, myCapo],
  );
};
