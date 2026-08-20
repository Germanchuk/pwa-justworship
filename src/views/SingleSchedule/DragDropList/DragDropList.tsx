import {
  Bars2Icon,
  ChatBubbleBottomCenterTextIcon,
  MusicalNoteIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import MagicItem from "./MagicItem/MagicItem";
import { NOTE_MAX_LENGTH, numberSongs, type ListPoint } from "#models/listPoint";

/**
 * Порядок пунктів служіння — секцією в стилі решти списків застосунку
 * (`BandsHome`): шапка з лічильником, рядки через `divide-y`, зліва кружечок
 * 44px. Кружечок тут — сама ручка перетягування: він і на місці аватарки з
 * інших екранів, і дає палець-розмірну зону захвату.
 *
 * Секція свідомо БЕЗ `overflow-hidden` (на відміну від інших): рядок під час
 * перетягування рухається трансформом і виїхав би за межі секції обрізаним.
 * Тому кути заокруглюємо самі — шапці й останньому рядку.
 *
 * Пункти бувають двох типів (див. `models/listPoint.ts`), і обидва
 * перетягуються однаково: порядок — це те, чим служіння і є. Різниця лише в
 * тому, що стоїть замість назви пісні.
 *
 * Програш окремим типом не є: це примітка з увімкненою ознакою «звучить», і
 * перемикач цієї ознаки стоїть просто в рядку примітки. Кнопок додавання все
 * одно дві — вони описують намір («тут гурт щось робить» / «тут звучить фон»),
 * а не тип пункту.
 */
const DragDropList = ({
  points,
  setItems,
  addItem,
  addNote,
  addSoundingNote,
  updateNote,
  toggleSounding,
  deleteItem,
}: {
  points: ListPoint[];
  setItems: (points: ListPoint[]) => void;
  addItem: (song: { id: number | string; name?: string }) => void;
  addNote: () => void;
  addSoundingNote: () => void;
  updateNote: (key: string, text: string) => void;
  toggleSounding: (key: string) => void;
  deleteItem: (key: string) => void;
}) => {
  const numbers = numberSongs(points);
  const songCount = numbers.filter((n) => n != null).length;

  const onDragEnd = (result) => {
    // If dropped outside the list
    if (!result.destination) {
      return;
    }

    // Reorder the items array
    const reorderedItems = Array.from(points);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems);
  };

  /** Як пункт називається у підказці кнопки «прибрати». */
  const labelOf = (point: ListPoint) => {
    if (point.kind === "song") return `«${point.name}»`;
    return point.sounding ? "програш" : "примітку";
  };

  return (
    <section className="mb-3 rounded-xl border border-border bg-background/60 shadow-xs">
      <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground/70">
          Порядок пісень
        </h2>
        {/* Лічильник рахує пісні, а не пункти: примітка між ними — не номер
            служіння, і в «сім пісень» її додавати нема за що. */}
        <span className="text-sm text-muted-foreground">{songCount}</span>
      </div>

      {/* Окремого «пісень ще немає» немає свідомо: останній рядок списку —
          саме поле додавання, і воно вже й є запрошенням. */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="droppable" direction="vertical">
          {(provided) => (
            <ul
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="m-0 flex list-none flex-col p-0"
            >
              {points.map((point, index) => (
                <Draggable
                  key={point.key}
                  draggableId={point.key}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex w-full items-center gap-3 border-t border-border p-3 first:border-t-0 ${
                        // Піднятий рядок має бути непрозорим і з тінню, інакше
                        // крізь нього просвічують сусіди.
                        snapshot.isDragging
                          ? "rounded-xl border-t-0 bg-background shadow-lg"
                          : ""
                      }`}
                      style={{
                        ...provided.draggableProps.style,
                        // Lock x-axis movement during drag
                        transform: provided.draggableProps.style?.transform
                          ? provided.draggableProps.style.transform.replace(
                              /\(\d+px,/,
                              "(0px,"
                            )
                          : null,
                      }}
                    >
                      <span
                        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full border border-border bg-muted text-foreground/70 active:cursor-grabbing"
                        aria-label="Перетягнути"
                        {...provided.dragHandleProps}
                      >
                        <Bars2Icon className="size-5" />
                      </span>

                      {point.kind === "song" && (
                        <span className="min-w-0 flex-1 truncate text-base font-semibold leading-tight">
                          {point.name}
                        </span>
                      )}

                      {/* Примітка правиться прямо тут: це рядок, який належить
                          лише цьому служінню, і окремий екран під один рядок
                          був би дорожчим за сам рядок. Це стосується й
                          програша — його текст теж просто примітка. */}
                      {point.kind === "note" && (
                        <>
                          <input
                            type="text"
                            value={point.text}
                            onChange={(e) => updateNote(point.key, e.target.value)}
                            maxLength={NOTE_MAX_LENGTH}
                            placeholder="Примітка для гурту"
                            className="min-w-0 grow appearance-none bg-transparent text-base outline-0 placeholder:text-muted-foreground"
                          />

                          {/* Ознака «звучить» — перемикач, а не тип: думку про
                              те, чи має тут бути фон, міняють уже після того,
                              як рядок стоїть у порядку, і видаляти пункт
                              заради цього не треба. */}
                          <button
                            type="button"
                            aria-pressed={point.sounding}
                            aria-label={
                              point.sounding
                                ? "Прибрати програш із примітки"
                                : "Зробити примітку програшем"
                            }
                            title={point.sounding ? "Звучить" : "Не звучить"}
                            className={`flex size-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                              point.sounding
                                ? "bg-accent text-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                            onClick={() => toggleSounding(point.key)}
                          >
                            <MusicalNoteIcon className="size-5" />
                          </button>
                        </>
                      )}

                      {/* Прибрати з цього служіння — не видалення пісні, тож
                          і не червона кнопка: червоне лишаємо підтвердженню
                          видалення самого списку. */}
                      <button
                        type="button"
                        aria-label={`Прибрати ${labelOf(point)} зі списку`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                        onClick={() => deleteItem(point.key)}
                      >
                        <XMarkIcon className="size-5" />
                      </button>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              <MagicItem addItem={addItem} />
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      {/* Примітка й програш — не пісні, тож і не в рядку пошуку: там шукають
          по бібліотеці гурту, а ці двоє нізвідки не беруться, вони просто
          з'являються в кінці порядку й перетягуються на місце. Обидві кнопки
          додають примітку — різниця лише в ознаці «звучить» і в тому, що
          програш одразу приходить із текстом. */}
      <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={addNote}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <ChatBubbleBottomCenterTextIcon className="size-4" />
          Додати примітку
        </button>
        <button
          type="button"
          onClick={addSoundingNote}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <MusicalNoteIcon className="size-4" />
          Додати програш
        </button>
      </div>
    </section>
  );
};

export default DragDropList;
