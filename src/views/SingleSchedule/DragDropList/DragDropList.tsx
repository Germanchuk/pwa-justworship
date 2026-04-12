import {Bars2Icon, TrashIcon} from "@heroicons/react/24/outline";
import {DragDropContext, Droppable, Draggable} from "react-beautiful-dnd";
import MagicItem from "./MagicItem/MagicItem";
import {useState} from "react";

const DragDropList = ({items, setItems, addItem, deleteItem}) => {
  const [isFocused, setIsFocused] = useState(false);
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
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="droppable" direction="vertical">
        {(provided) => (
          <ul {...provided.droppableProps} ref={provided.innerRef}>
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                {(provided, snapshot) => (
                  <li
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`
                        ${
                      snapshot.isDragging
                        ? "bg-base-200 shadow"
                        : "bg-white"
                    }
                        flex gap-4 justify-between items-center py-1 border-b border-base-300 w-full
                      `}
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
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-8 flex items-center justify-center text-base-700"
                        {...provided.dragHandleProps}
                      >
                        <Bars2Icon className="w-5 h-5"/>
                      </div>
                      {item.name}
                    </div>
                    <button
                      className="btn btn-sm btn-square bg-delete-base text-delete-content"
                      onClick={() => deleteItem(item.id)}
                    >
                      <TrashIcon className="w-4 h-4"/>
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
  );
};

export default DragDropList;
