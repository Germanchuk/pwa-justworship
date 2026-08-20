import { Link } from "react-router-dom";
import { MusicalNoteIcon } from "@heroicons/react/24/outline";

import { bandPath } from "#constants/routes";
import { numberSongs, type ListPoint } from "#models/listPoint";

/**
 * Порядок пунктів у режимі читання — те, з чим гурт стоїть на служінні.
 * Свідомо окремий компонент, а не прапорець усередині `DragDropList`: тут не
 * монтується drag-and-drop, тож рядок пісні можна віддати цілком під
 * посилання, і жодна кнопка, здатна щось зіпсувати, на екран не потрапляє.
 *
 * Список тримає пункти двох типів (див. `models/listPoint.ts`), тож рядок
 * вибирається за типом пункту. Кружечок зліва показує номер — і номер цей
 * рахує саме ПІСНІ: на репетиції домовляються «давай з третьої», і примітка
 * між ними цього рахунку збивати не повинна. У правці те саме місце займає
 * ручка перетягування — одне місце, дві ролі за режимом.
 */
export default function SongsOrder({
  points,
  bandId,
}: {
  points: ListPoint[];
  bandId: number | string;
}) {
  const numbers = numberSongs(points);
  const songCount = numbers.filter((n) => n != null).length;

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground/70">Порядок пісень</h2>
        <span className="text-sm text-muted-foreground">{songCount}</span>
      </div>

      {points.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          Пісень ще немає — додай їх у режимі правки.
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {points.map((point, index) => (
            <li key={point.key}>
              {point.kind === "song" && (
                <Link
                  to={bandPath.song(bandId, point.songId)}
                  className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-accent/60"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-base font-semibold text-foreground/70">
                    {numbers[index]}
                  </span>
                  {/* Синій — той самий, яким по всьому застосунку позначені
                      переходи («Усі списки →», «Склад гурту →»): на цьому
                      екрані назва пісні має читатись саме як вхід у пісню. */}
                  <span className="min-w-0 flex-1 truncate text-base font-semibold leading-tight text-blue-900">
                    {point.name}
                  </span>
                </Link>
              )}

              {/* Примітка нікуди не веде й номера не займає: це підказка гурту
                  посеред порядку, а не пункт, з якого можна «почати». Програш —
                  та сама примітка, лише зі значком: своїм рядком він тут не
                  стоїть, бо поза зібранням його просто немає. */}
              {point.kind === "note" && (
                <div className="flex w-full items-center gap-3 p-3 text-start">
                  {point.sounding ? (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
                      <MusicalNoteIcon className="size-5" />
                    </span>
                  ) : (
                    <span className="size-11 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 text-base leading-tight text-muted-foreground">
                    {point.text}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
