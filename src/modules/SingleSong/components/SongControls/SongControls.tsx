import React, {useEffect} from "react";

import DronePlayer from "../../services/DronePlayer/DronePlayer";
import {useCanAnnotate, useCanPlay} from "../../mode";
import {AutoscrollControls, AutoscrollEdge} from "./AutoscrollControls";
import {NotesAudienceSelect} from "../SlateLyricsPlayground/comments/NotesAudienceSelect";
import {ModeSwitch} from "./ModeSwitch/ModeSwitch";
import {PlaybackControls} from "./PlaybackControls";
import {SongActions} from "./SongActions";
import {SongMenuSlot} from "./menuSlot";
import {useSongMenuOpen} from "./menuOpen";

/**
 * Меню сторінки пісні (`APP-24`, `APP-26`–`APP-29`), що висить у правому
 * верхньому куті поверх пісні. Кнопка, яка його відкриває, і «назад» — у
 * нижньому барі; стан «відкрите» спільний з нею (`useSongMenuOpen`). Окрема
 * кнопка — скляна плитка (`MENU_TILE`); кнопки, що діють разом (перемикач
 * режимів), — одна плашка зі спільним фоном (`MENU_GROUP`).
 *
 *   закрито:  [📖]   ← лише поточний режим
 *
 *   відкрито: [📖]
 *             [✏️]   ← той самий перемикач, розгорнутий
 *             [🗒]
 *
 *             [⋯]    ← дії з піснею (нативний список)
 *             [⏻]    ← кнопки режиму: дрон і автоскрол у читанні,
 *             [⇊]      адресат у примітках, у редагуванні нічого
 *
 *             [🖍]   ← слот: палітра / меню позначки (`SongMenuSlot`)
 *
 * Меню закривається ЛИШЕ своєю кнопкою (`APP-28`): вибір режиму, дія чи тап
 * повз нього панель не згортають — хто керує звуком, тримає її відкритою.
 */
export const SongControls = () => {
  const [open] = useSongMenuOpen();
  const canPlay = useCanPlay();

  // Вийшли з режиму читання — глушимо СВІЙ звук. Хоста не чіпаємо: він грає
  // для всього гурту, а не для цього екрана. Живе тут, а не біля кнопок
  // програвання: ті змонтовані лише у відкритому меню.
  useEffect(() => {
    if (!canPlay) DronePlayer.getInstance().stop();
  }, [canPlay]);

  return (
    <>
      <AutoscrollEdge />
      <div
        // Один проміжок між усіма групами кнопок — і в рядку, і в стовпчику.
        className="fixed right-2 z-40 flex flex-col items-end gap-2"
        style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <ModeSwitch expanded={open} />
        {open && <SongActions />}
        {open && <ModeActions />}

        <SongMenuSlot />
      </div>
    </>
  );
};

/**
 * Кнопки поточного режиму — плитки під «⋯»: дрон (`PLAY-2`) і під ним
 * автоскрол (`SCROLL-4`) у читанні, адресат приміток у примітках, у
 * редагуванні нічого.
 */
const ModeActions = () => {
  const canPlay = useCanPlay();
  const canAnnotate = useCanAnnotate();
  if (canPlay) {
    return (
      <>
        <PlaybackControls />
        <AutoscrollControls />
      </>
    );
  }
  if (canAnnotate) return <NotesAudienceSelect />;
  return null;
};
