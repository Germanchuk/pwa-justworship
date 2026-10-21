/**
 * Доріжки пісні (ADR-0008): додані — порядок перетягуванням, назва, додати,
 * прибрати й повернути; слова й акорди — внизу, на сталому місці. Спільне для всіх — правиться лише в режимі правки; кожна дія — один
 * крок undo (`change`). Сховати доріжку собі — перемикачі в шапці.
 */
import { useState } from "react";
import { Bars2Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { DragDropContext, Draggable, Droppable, type DropResult } from "react-beautiful-dnd";
import { MetaModal } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/MetaModal/MetaModal";
import {
  addLane,
  allLanes,
  CELL_KINDS,
  isTextKind,
  KIND_NAMES,
  linesOf,
  moveLane,
  removeLane,
  renameLane,
  restoreLane,
  Song,
} from "../../model";

type Props = { song: Song; change: (fn: () => void) => void; onClose: () => void };

export function LanesPanel({ song, change, onClose }: Props) {
  const { doc } = song;
  const all = allLanes(doc);
  // Перетягуються лише додані: слова й акорди стоять внизу на сталому місці.
  const lanes = all.filter((l) => !l.removed && !isTextKind(l.kind));
  const fixed = all.filter((l) => isTextKind(l.kind));
  const removed = all.filter((l) => l.removed);

  const onDragEnd = ({ source, destination, draggableId }: DropResult) => {
    if (destination && destination.index !== source.index) change(() => moveLane(doc, draggableId, destination.index));
  };

  return (
    <MetaModal title="Доріжки пісні" onClose={onClose}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="lanes">
          {(drop) => (
            <ul ref={drop.innerRef} {...drop.droppableProps} className="divide-y rounded border">
              {lanes.map((lane, i) => (
                <Draggable key={lane.id} draggableId={lane.id} index={i}>
                  {(drag) => (
                    <li ref={drag.innerRef} {...drag.draggableProps} className="flex items-center gap-2 bg-white px-2 py-1.5">
                      <span {...drag.dragHandleProps} className="text-stone-400" aria-label="Перетягнути">
                        <Bars2Icon className="w-5 h-5" />
                      </span>
                      <LaneName name={lane.name} onRename={(name) => change(() => renameLane(doc, lane.id, name))} />
                      {lane.name !== KIND_NAMES[lane.kind] && (
                        <span className="text-xs text-stone-400">{KIND_NAMES[lane.kind]}</span>
                      )}
                      <button
                        type="button"
                        className="text-stone-400 hover:text-red-600"
                        aria-label={`Прибрати доріжку «${lane.name}»`}
                        onClick={() => change(() => removeLane(doc, lane.id))}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </li>
                  )}
                </Draggable>
              ))}
              {drop.placeholder}
              {fixed.map((lane) => (
                <li key={lane.id} className="flex items-center gap-2 bg-stone-50 px-2 py-1.5 text-sm text-stone-500">
                  <span className="w-5" />
                  {lane.name}
                </li>
              ))}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-3 text-xs text-stone-500">Додати доріжку</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm hover:bg-stone-50"
          onClick={() => change(() => addLane(song, "text", linesOf(song)))}
        >
          + Слова (вигуки)
        </button>
        {CELL_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="rounded border px-2 py-1 text-sm hover:bg-stone-50"
            onClick={() => change(() => addLane(song, kind, linesOf(song)))}
          >
            + {KIND_NAMES[kind]}
          </button>
        ))}
      </div>

      {removed.length > 0 && (
        <>
          <div className="mt-3 text-xs text-stone-500">Прибрані — вміст збережено</div>
          <ul className="mt-1 text-sm">
            {removed.map((lane) => (
              <li key={lane.id} className="flex items-center justify-between py-0.5">
                <span className="text-stone-500">{lane.name}</span>
                <button type="button" className="text-xs underline" onClick={() => change(() => restoreLane(doc, lane.id))}>
                  повернути
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-2 text-xs text-stone-400">Вигуки — текстом, як акорди. Прямокутники, таби й кахон — прототип.</div>
      <div className="flex justify-end mt-3">
        <button type="button" className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50" onClick={onClose}>
          Готово
        </button>
      </div>
    </MetaModal>
  );
}

/** Назва пишеться в документ, коли закінчили (а не на кожну літеру — інакше кожна літера стала б кроком undo). */
function LaneName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() && draft !== name) onRename(draft.trim());
    setDraft(null);
  };
  return (
    <input
      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      value={draft ?? name}
      aria-label="Назва доріжки"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
