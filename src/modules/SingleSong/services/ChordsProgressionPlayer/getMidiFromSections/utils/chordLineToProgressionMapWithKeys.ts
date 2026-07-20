import type {ChordEvent} from "./createMidiFromProgression";

export interface LineToken {
  token: string;
  /** Index of this token in the flat per-line stream (including `.` continuations and `|` bars). */
  tokenIndex: number;
  /** Character offset of token start within the original line text. */
  charStart: number;
  /** Character offset just after the last char of the token. */
  charEnd: number;
}

/**
 * Tokenize a chord-line text into a flat stream of `|`, `.`, and chord-name tokens,
 * preserving each token's character offsets within the original string. The dot-glue
 * splitting matches `chordLineToProgressionMap`'s lexer so token indexes stay aligned.
 */
export function tokenizeChordLine(text: string): LineToken[] {
  const out: LineToken[] = [];
  let tokenIndex = 0;
  const wordRe = /\S+/g;
  let m: RegExpExecArray | null;

  while ((m = wordRe.exec(text)) !== null) {
    const word = m[0];
    const wordStart = m.index;

    if (word === "|") {
      out.push({token: "|", tokenIndex: tokenIndex++, charStart: wordStart, charEnd: wordStart + 1});
      continue;
    }

    // Split into runs of '.' and non-'.' while preserving offsets.
    const subRe = /\.+|[^.]+/g;
    let s: RegExpExecArray | null;
    while ((s = subRe.exec(word)) !== null) {
      const piece = s[0];
      const pieceStart = wordStart + s.index;

      if (piece.startsWith(".")) {
        // Each '.' is its own continuation token.
        for (let i = 0; i < piece.length; i++) {
          const at = pieceStart + i;
          out.push({token: ".", tokenIndex: tokenIndex++, charStart: at, charEnd: at + 1});
        }
        continue;
      }

      // Non-dot piece may still contain '|' if user wrote `G|D` without spaces.
      const barRe = /\||[^|]+/g;
      let b: RegExpExecArray | null;
      while ((b = barRe.exec(piece)) !== null) {
        const sub = b[0];
        const subStart = pieceStart + b.index;
        if (sub === "|") {
          out.push({token: "|", tokenIndex: tokenIndex++, charStart: subStart, charEnd: subStart + 1});
        } else {
          out.push({
            token: sub,
            tokenIndex: tokenIndex++,
            charStart: subStart,
            charEnd: subStart + sub.length,
          });
        }
      }
    }
  }

  return out;
}

/**
 * A chord or group of chords must live inside a properly opened AND closed bar
 * — i.e. the trimmed line must start with `|` and end with `|`. Otherwise we
 * have no measure boundaries and refuse to invent durations.
 *
 * Lines that satisfy the rule but carry no chord tokens (e.g. `|`, `| |`) are
 * "playable" structurally — just silent. Not invalid.
 */
export function isPlayableChordLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

/**
 * Slate-aware analogue of `chordLineToProgressionMap`. Reproduces the bar/dot/chord
 * lexer semantics but tags every chord-event with a stable token key derived from
 * its position in the document.
 *
 * `tokenKey` format: `${sectionIndex}:${chordLineIndex}:${tokenIndex}`.
 * Rest events (chord === null) emit `tokenKey: null`.
 */
export function chordLineToProgressionMapWithKeys(
  text: string,
  sectionIndex: number,
  chordLineIndex: number,
  beatsPerBar = 4,
): ChordEvent[] {
  const all = tokenizeChordLine(text);
  const makeKey = (tokenIndex: number) =>
    `${sectionIndex}:${chordLineIndex}:${tokenIndex}`;

  // Group tokens into bars (split on '|').
  const bars: LineToken[][] = [];
  let current: LineToken[] = [];
  for (const tk of all) {
    if (tk.token === "|") {
      if (current.length > 0) bars.push(current);
      current = [];
    } else {
      current.push(tk);
    }
  }
  if (current.length > 0) bars.push(current);

  const out: ChordEvent[] = [];

  for (const bar of bars) {
    if (bar.length === 0) continue;

    const chordTokens = bar.filter((t) => t.token !== ".");

    // Спецвипадок: один акорд і жодної крапки → повний такт.
    if (chordTokens.length === 1 && bar.every((t) => t.token !== ".")) {
      out.push({
        chord: chordTokens[0].token,
        duration: beatsPerBar,
        tokenKey: makeKey(chordTokens[0].tokenIndex),
      });
      continue;
    }

    const startIdx = out.length;
    for (const tk of bar) {
      if (tk.token === ".") {
        if (out.length === startIdx) {
          out.push({chord: null, duration: 1, tokenKey: null});
        } else {
          out[out.length - 1].duration += 1;
        }
      } else {
        out.push({chord: tk.token, duration: 1, tokenKey: makeKey(tk.tokenIndex)});
      }
    }
  }

  return out;
}
