/**
 * Нова примітка (режим приміток): виділи текст в ОДНІЙ доріжці одного рядка,
 * натисни «Примітка» — текст, колір і хто бачить. Порожній текст — просто
 * підсвітка.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  COMMENT_PALETTE,
  isStrike,
  STRIKE_COLOR,
  STRIKE_INK,
} from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { useBandMembers } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/useBandMembers";
import { addNote, Pos, Song } from "../../model";

export type NoteTarget = { anchor: Pos; focus: Pos; quote: string };

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

type Props = {
  song: Song;
  me: string;
  /** Чиїми очима зараз дивимось — початковий вибір «хто бачить». */
  audience: string[];
  target: NoteTarget;
  onClose: () => void;
};

export function NoteComposer({ song, me, audience: viewers, target, onClose }: Props) {
  const members = useBandMembers();
  const [body, setBody] = useState("");
  const [color, setColor] = useState(COMMENT_PALETTE[0].hex);
  // Початково — ті, чиїми очима дивимось (`NOTE-21`); останнього зняти не можна (`NOTE-38`).
  const [audience, setAudience] = useState<string[]>(viewers.length ? viewers : [me]);
  const toggle = (nick: string) =>
    setAudience((a) => (a.includes(nick) ? (a.length > 1 ? a.filter((n) => n !== nick) : a) : [...a, nick]));

  const save = () => {
    const { anchor, focus } = target;
    const from = Math.min(anchor.offset, focus.offset);
    const to = Math.max(anchor.offset, focus.offset);
    // Нових публічних коментарів немає (`NOTE-3`): примітка — завжди переліку людей.
    const visibleFor = audience;
    song.doc.transact(() => addNote(song, anchor.line, anchor.lane, from, to, { id: newId(), author: me, visibleFor, color, body: body.trim() }));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-medium mb-2">
          Примітка до «<span className="font-semibold">{target.quote}</span>»
        </div>
        <textarea
          autoFocus
          className="w-full border border-gray-300 rounded px-2 py-1 text-base min-h-20"
          placeholder="Текст (порожньо — просто підсвітка)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-2 my-2">
          {[...COMMENT_PALETTE.map((c) => c.hex), STRIKE_COLOR].map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={isStrike(hex) ? "закреслення" : hex}
              onClick={() => setColor(hex)}
              className={`w-7 h-7 rounded-full flex items-center justify-center ${color === hex ? "ring-2 ring-offset-1 ring-stone-700" : ""}`}
              style={{ background: isStrike(hex) ? "white" : hex, border: isStrike(hex) ? `2px solid ${STRIKE_INK}` : undefined }}
            >
              {isStrike(hex) && <span style={{ textDecoration: "line-through", color: STRIKE_INK }}>S</span>}
            </button>
          ))}
        </div>
        <div className="text-xs text-stone-500 mb-1">Хто бачить</div>
        <div className="flex flex-wrap gap-1.5 mb-3 text-sm">
          {[me, ...members.map((m) => m.username).filter((n) => n && n !== me)].map((nick) => (
            <button
              key={nick}
              type="button"
              onClick={() => toggle(nick)}
              className={`rounded-full border px-2 py-0.5 ${audience.includes(nick) ? "bg-stone-700 text-white" : ""}`}
            >
              {nick === me ? "я" : nick}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-1 rounded border" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="px-3 py-1 rounded bg-amber-500 text-white" onClick={save}>
            Зберегти
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
