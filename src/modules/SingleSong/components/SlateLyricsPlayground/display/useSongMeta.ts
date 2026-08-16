import { useDispatch, useSelector } from "react-redux";

import { toggleSongMeta } from "#layout/slices/viewConfigSlice";
import { useMetaHideApplies } from "../../../mode";

/**
 * Згортання шапки пісні — назви й мета-рядка (темп, розмір, тональність,
 * капо, фільтри показу).
 *
 * Чому не в документі, як капо й фільтри слів/акордів: ті — про саму пісню
 * («як я її читаю»), і їх варто везти за собою з пристрою на пристрій. Тут
 * же — суто про екран: скільки з нього віддати пісні. Тому стан лежить у
 * `viewConfigSlice` поруч із згортанням шапки застосунку, спільний для всіх
 * пісень і без запису в спільний Y.Doc.
 *
 * Друга причина того ж рішення технічна: перемикач стоїть у `SongControls`,
 * а вони рендеряться в `PageBar` — поза деревом `<Slate>`, тож жодного
 * `useSlate` там немає. Redux — єдиний канал, спільний для панелі й редактора.
 */

/** Сирий стан перемикача (те, що обрав користувач). */
export const useSongMetaVisible = (): boolean =>
  useSelector((state: any) => state.viewConfig.songMetaVisible as boolean);

/** Чи шапка пісні схована ЗАРАЗ — з поправкою на режим (див. `mode.tsx`). */
export const useSongMetaHidden = (): boolean => {
  const visible = useSongMetaVisible();
  const applies = useMetaHideApplies();
  return applies && !visible;
};

export const useToggleSongMeta = () => {
  const dispatch = useDispatch();
  return () => dispatch(toggleSongMeta());
};
