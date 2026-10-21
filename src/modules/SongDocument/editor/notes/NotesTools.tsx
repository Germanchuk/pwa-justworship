/**
 * Палітра й меню позначки (`NOTE-6`–`NOTE-9`, `NOTE-36`–`NOTE-44`) — одразу
 * під меню пісні, порталом у його слот. Працюють у будь-якому режимі:
 *
 *  - виділив текст в ОДНІЙ доріжці одного рядка — палітра: тап по кольору
 *    (чи закресленню) ставить позначку й одразу обирає її (`NOTE-7`).
 *    Виділення через кілька рядків чи доріжок позначкою не стає (`NOTE-46`) —
 *    палітри тоді немає;
 *  - тап по позначеному тексту обирає позначки під пальцем — їхнє меню:
 *    колір, область, хто бачить, додати чи прибрати текст, видалити.
 *
 * Діапазон живе тут, а не в `view.selection`: у читанні редактор read-only, і
 * slate-react на кожен `selectionchange` знімає своє виділення. Тож джерело —
 * виділення браузера (і тап), як у старому редакторі.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Range, type BaseRange } from "slate";
import { ReactEditor } from "slate-react";
import { Highlighter, MessageSquareOff, MessageSquarePlus, Strikethrough, TextSelect, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MENU_GROUP, MENU_GROUP_ITEM, MENU_TILE } from "#modules/SingleSong/components/SongControls/tile";
import { useSongMenuSlot } from "#modules/SingleSong/components/SongControls/menuSlot";
import {
  cardBorder,
  COMMENT_PALETTE,
  highlightBg,
  isStrike,
  selectedBg,
  STRIKE_COLOR,
} from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { setPendingFocus } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/pendingFocus";
import { useBandMembers } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/useBandMembers";
import { addNote, ALL, moveNoteTo, othersSeeing, removeNote, updateNote, type NoteView, type Pos, type Song } from "../../model";
import type { LaneView } from "../../bridge/laneView";

/** Позначає інтерфейс приміток: тап по ньому не скидає ні виділення, ні обрану позначку. */
const NOTES_UI = "data-notes-ui";
const KEEP = `[${NOTES_UI}], [role="menu"]`;

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const keep = (e: React.MouseEvent) => e.preventDefault(); // тап по кнопці не знімає виділення

/**
 * Вузол — текст пісні, а не острівець усередині редактора (картка примітки,
 * смужка динаміки). У читанні сам корінь `contenteditable="false"`, тож
 * острівець — найближчий такий предок, що не корінь.
 */
function isSongText(root: HTMLElement, node: Node | null) {
  if (!node || !root.contains(node)) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const island = el?.closest('[contenteditable="false"]');
  return !island || island === root;
}

/** Виділення браузера в пісні й позначки, обрані тапом. */
function useNotesSelection(lanes: LaneView) {
  const { view } = lanes;
  const [range, setRange] = useState<BaseRange | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    const root = ReactEditor.toDOMNode(view, view);
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return; // згорнуте — вирішує тап
      if (!isSongText(root, sel.anchorNode) || !isSongText(root, sel.focusNode)) return;
      const next = ReactEditor.toSlateRange(view, sel, { exactMatch: false, suppressThrow: true });
      if (!next || Range.isCollapsed(next)) return;
      setRange((prev) => (prev && Range.equals(prev, next) ? prev : next));
      setPicked([]);
    };
    const onClick = (e: MouseEvent) => {
      if (!isSongText(root, e.target as Node)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // протягування — уже підхопив selectionchange
      setRange(null);
      const ids = (e.target as Element).closest?.("[data-notes]")?.getAttribute("data-notes");
      setPicked(ids ? ids.split(" ") : []);
    };
    // Друк у пісні (правка) — виділення й вибір більше не ті.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSongText(root, e.target as Node)) return;
      setRange(null);
      setPicked([]);
    };
    const onClickOutside = (e: MouseEvent) => {
      // Шлях, а не `closest`: кнопка палітри, що зникла від свого ж тапу, вже відірвана від сторінки.
      const path = e.composedPath();
      if (path.includes(root)) return;
      if (path.some((n) => n instanceof Element && n.matches(KEEP))) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // протягування мишею закінчилось поза піснею
      setRange(null);
      setPicked([]);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("click", onClickOutside);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("click", onClickOutside);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [view]);

  /** Шматки виділення в моделі: доріжка рядка — один шматок. */
  const pieces = (): { anchor: Pos; focus: Pos }[] => {
    try {
      return range ? lanes.modelPieces(range) : [];
    } catch {
      return []; // діапазон застарів — документ змінився під ногами
    }
  };
  /** Обрати позначку програмно: нативне виділення знімаємо, щоб не висіло поверх. */
  const pick = (ids: string[]) => {
    window.getSelection()?.removeAllRanges();
    setRange(null);
    setPicked(ids);
  };
  return { range, picked, pieces, pick };
}

const span = (p: { anchor: Pos; focus: Pos }) => {
  const [from, to] = [p.anchor.offset, p.focus.offset].sort((a, b) => a - b);
  return { line: p.anchor.line, lane: p.anchor.lane, from, to };
};

/** Обрані позначки — густіше й підкреслені своїм кольором (`NOTE-36`); `!important` — фон стоїть інлайном. */
const pickedCss = (views: NoteView[]) =>
  views
    .map(({ note }) => {
      const sel = `[data-notes~="${CSS.escape(note.id)}"]`;
      return `${sel} { background: ${selectedBg(note.color)} !important; box-shadow: inset 0 -2px 0 ${cardBorder(note.color)}; }`;
    })
    .join("\n");

type Props = {
  song: Song;
  lanes: LaneView;
  me: string;
  viewers: string[];
  notes: NoteView[];
  addDraft: (id: string) => void;
  dropDraft: (id: string) => void;
};

export function NotesTools({ song, lanes, me, viewers, notes, addDraft, dropDraft }: Props) {
  const slot = useSongMenuSlot();
  const { range, picked, pieces, pick } = useNotesSelection(lanes);
  // Позначка, чию область зараз змінюють (`NOTE-43`): виділення тоді — нова область.
  const [resizing, setResizing] = useState<string | null>(null);

  const one = !resizing && range ? pieces() : [];
  const palette = one.length === 1;
  const pickedViews = resizing ? [] : notes.filter((n) => picked.includes(n.note.id) && n.status === "visible" && !n.foreign);
  const visible = !!resizing || palette || pickedViews.length > 0;

  const apply = (color: string) => {
    if (!palette) return;
    const { line, lane, from, to } = span(one[0]);
    const id = newId();
    // Адресати — ті, чиїми очима дивлюсь, одним записом (`NOTE-21`); автор — я.
    song.doc.transact(() => addNote(song, line, lane, from, to, { id, author: me, visibleFor: [...viewers], color, body: "" }));
    pick([id]);
  };

  const startResize = (n: NoteView) => {
    const sel = window.getSelection();
    const anchor = n.at && lanes.toView({ line: n.at.line, lane: n.lane, offset: n.at.from });
    const focus = n.at && lanes.toView({ line: n.at.line, lane: n.lane, offset: n.at.to });
    if (!sel || !anchor || !focus) return;
    try {
      const dom = ReactEditor.toDOMRange(lanes.view, { anchor, focus });
      sel.removeAllRanges();
      sel.addRange(dom);
    } catch {
      return;
    }
    setResizing(n.note.id);
  };
  // Той самий тап застосовує; виділення зняли чи воно через кілька рядків — область та сама.
  const finishResize = () => {
    const n = notes.find((v) => v.note.id === resizing);
    const now = range ? pieces() : [];
    if (n && now.length === 1) {
      const { line, lane, from, to } = span(now[0]);
      song.doc.transact(() => moveNoteTo(song, n.holder, n.lane, n.note.id, line, lane, from, to));
    }
    pick(resizing ? [resizing] : []);
    setResizing(null);
  };

  if (!slot) return null;
  return createPortal(
    <div
      {...{ [NOTES_UI]: "" }}
      className="flex flex-col items-end gap-2 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
      onMouseDown={keep}
    >
      {pickedViews.length > 0 && <style>{pickedCss(pickedViews)}</style>}

      {resizing && (
        <Button variant="ghost" size="icon" className={cn(MENU_TILE, "bg-accent")} onClick={finishResize} aria-label="Застосувати область" title="Застосувати область">
          <TextSelect className="size-6" />
        </Button>
      )}

      {palette && (
        <div className={cn(MENU_GROUP, "flex-col")}>
          {COMMENT_PALETTE.map((c) => (
            <Swatch key={c.name} color={c.hex} title={`Виділити: ${c.name}`} onClick={() => apply(c.hex)}>
              <Highlighter className="size-6" />
            </Swatch>
          ))}
          {/* Іконка інша: кольорові розрізняються кольором, а закреслення його не має. */}
          <Swatch color={STRIKE_COLOR} title="Закреслити" onClick={() => apply(STRIKE_COLOR)}>
            <Strikethrough className="size-6" />
          </Swatch>
        </div>
      )}

      {pickedViews.map((n) => {
        const noted = !!n.note.body;
        // Скільки адресатів переживе видалення — кнопка каже чесно (`NOTE-25`).
        const rest = othersSeeing(n.note, viewers);
        const deleteTitle = rest > 0 ? `Видалити у вибраних (лишиться ще в ${rest})` : "Видалити повністю";
        const noteTitle = noted ? "Прибрати нотатку, лишити виділення" : "Додати нотатку";
        const change = (patch: Parameters<typeof updateNote>[3]) => song.doc.transact(() => updateNote(n.holder, n.lane, n.note.id, patch));
        return (
          <div key={n.note.id} className={cn(MENU_GROUP, "flex-col")}>
            <ColorMenu color={n.note.color} onPick={(color) => change({ color })} />
            <Button variant="ghost" size="icon" className={MENU_GROUP_ITEM} onClick={() => startResize(n)} aria-label="Змінити область" title="Змінити область">
              <TextSelect className="size-6" />
            </Button>
            <AudienceMenu me={me} visibleFor={n.note.visibleFor} onChange={(visibleFor) => change({ visibleFor })} />
            <Button
              variant="ghost"
              size="icon"
              className={MENU_GROUP_ITEM}
              aria-label={noteTitle}
              title={noteTitle}
              onClick={() => {
                if (noted) {
                  // Текст — на весь запис, не лише на відмічених (`NOTE-33`).
                  change({ body: "" });
                  dropDraft(n.note.id);
                } else {
                  setPendingFocus(n.note.id); // тут же, у тапі: iOS відкриє клавіатуру
                  addDraft(n.note.id);
                }
              }}
            >
              {noted ? <MessageSquareOff className="size-6" /> : <MessageSquarePlus className="size-6" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={MENU_GROUP_ITEM}
              aria-label={deleteTitle}
              title={deleteTitle}
              onClick={() => {
                song.doc.transact(() => removeNote(n.holder, n.lane, n.note, viewers));
                pick([]);
              }}
            >
              <Trash2 className="size-6" />
            </Button>
          </div>
        );
      })}
    </div>,
    slot,
  );
}

/** Кнопка палітри — квадрат на спільній плашці, фон — відтінок підсвітки. */
function Swatch({ color, title, onClick, children }: { color: string; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={keep}
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{ backgroundColor: highlightBg(color) }}
      className={cn(MENU_GROUP_ITEM, "inline-flex items-center justify-center transition-transform cursor-pointer active:scale-95 text-foreground")}
    >
      {children}
    </button>
  );
}

/** Кружок кольору; у закреслення кольору нема — його іконка. */
const ColorDot = ({ color }: { color: string }) =>
  isStrike(color) ? (
    <Strikethrough className="size-6" />
  ) : (
    <span className="size-6 rounded-full border border-black/10" style={{ backgroundColor: cardBorder(color) }} />
  );

const menuIconButton = cn(buttonVariants({ variant: "ghost", size: "icon" }), MENU_GROUP_ITEM);

/** Колір позначки (`NOTE-42`): та сама палітра, що й при створенні. */
function ColorMenu({ color, onPick }: { color: string; onPick: (color: string) => void }) {
  const options = [...COMMENT_PALETTE.map((c) => ({ key: c.name, color: c.hex })), { key: "strike", color: STRIKE_COLOR }];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger title="Колір" aria-label="Колір" className={menuIconButton}>
        <ColorDot color={color} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start" className="min-w-0 p-1">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.key}
            title={o.key === "strike" ? "Закреслення" : o.key}
            onSelect={() => onPick(o.color)}
            className={cn("justify-center rounded-lg p-2", o.color === color && "bg-accent")}
          >
            <ColorDot color={o.color} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Хто бачить позначку (`NOTE-37`–`NOTE-41`): учасники з галочками, правка
 * одразу в документ. Останню галочку не зняти; зняв себе — позначка зникла з
 * мого екрана. Публічному коментарю й соло-гурту кнопки нема. Хто вийшов з
 * гурту, але досі в адресатах, — теж у списку.
 */
function AudienceMenu({ me, visibleFor, onChange }: { me: string; visibleFor: string[]; onChange: (v: string[]) => void }) {
  const members = useBandMembers();
  if (visibleFor.includes(ALL)) return null;
  const names = members.map((m) => m.username).filter((u): u is string => !!u && u !== me);
  const former = visibleFor.filter((u) => u !== me && !names.includes(u));
  const ordered = [me, ...names, ...former];
  if (ordered.length < 2) return null;
  const toggle = (nick: string) => {
    const next = new Set(visibleFor);
    if (!next.delete(nick)) next.add(nick);
    onChange(ordered.filter((u) => next.has(u)));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger title="Хто бачить" aria-label="Хто бачить" className={menuIconButton}>
        <Users className="size-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="end" className="min-w-48">
        <DropdownMenuLabel>Хто бачить</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ordered.map((nick) => {
          const checked = visibleFor.includes(nick);
          return (
            <DropdownMenuCheckboxItem
              key={nick}
              checked={checked}
              disabled={checked && visibleFor.length === 1}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(nick)}
            >
              {nick === me ? "Я" : nick}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
