import { Bars2Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import MagicItem from "./MagicItem/MagicItem";

/**
 * Порядок пісень служіння — секцією в стилі решти списків застосунку
 * (`BandsHome`): шапка з лічильником, рядки через `divide-y`, зліва кружечок
 * 44px. Кружечок тут — сама ручка перетягування: він і на місці аватарки з
 * інших екранів, і дає палець-розмірну зону захвату.
 *
 * Секція свідомо БЕЗ `overflow-hidden` (на відміну від інших): рядок під час
 * перетягування рухається трансформом і виїхав би за межі секції обрізаним.
 * Тому кути заокруглюємо самі — шапці й останньому рядку.
 */
const DragDropList = ({ items, setItems, addItem, deleteItem }) => {
  const onDragEnd = (result) => {
    // If dropped outside the list
    if (!result.destination) {
      return;
    }

    // Reorder the items array
    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems);
  };

  return (
    <section className="mb-3 rounded-xl border border-border bg-background/60 shadow-xs">
      <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground/70">
          Порядок пісень
        </h2>
        <span className="text-sm text-muted-foreground">{items.length}</span>
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
              {items.map((item, index) => (
                <Draggable
                  key={item.id}
                  draggableId={String(item.id)}
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

                      <span className="min-w-0 flex-1 truncate text-base font-semibold leading-tight">
                        {item.name}
                      </span>

                      {/* Прибрати з цього служіння — не видалення пісні, тож
                          і не червона кнопка: червоне лишаємо підтвердженню
                          видалення самого списку. */}
                      <button
                        type="button"
                        aria-label={`Прибрати «${item.name}» зі списку`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                        onClick={() => deleteItem(item.id)}
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
    </section>
  );
};

export default DragDropList;
