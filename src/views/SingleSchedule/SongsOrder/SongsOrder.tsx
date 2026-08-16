import { Link } from "react-router-dom";

import { bandPath } from "#constants/routes";

/**
 * Порядок пісень у режимі читання — те, з чим гурт стоїть на служінні.
 * Свідомо окремий компонент, а не прапорець усередині `DragDropList`: тут не
 * монтується drag-and-drop, тож рядок можна віддати цілком під посилання, і
 * жодна кнопка, здатна щось зіпсувати, на екран не потрапляє.
 *
 * Кружечок зліва показує номер пісні: на репетиції домовляються саме
 * номерами («давай з третьої»). У правці те саме місце займає ручка
 * перетягування — одне місце, дві ролі за режимом.
 */
export default function SongsOrder({ items, bandId }) {
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground/70">
          Порядок пісень
        </h2>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          Пісень ще немає — додай їх у режимі правки.
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                to={bandPath.song(bandId, item.id)}
                className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-accent/60"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-base font-semibold text-foreground/70">
                  {index + 1}
                </span>
                {/* Синій — той самий, яким по всьому застосунку позначені
                    переходи («Усі списки →», «Склад гурту →»): на цьому
                    екрані назва пісні має читатись саме як вхід у пісню. */}
                <span className="min-w-0 flex-1 truncate text-base font-semibold leading-tight text-blue-900">
                  {item.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
