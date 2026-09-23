import React, {createContext, useContext, useMemo, useState} from "react";

/**
 * Місце під стовпчиком меню пісні, куди інші частини сторінки ставлять свої
 * кнопки (палітра й меню позначки, `NOTE-9`). Вони живуть в іншому дереві —
 * всередині редактора, — тож приходять сюди порталом, а висоту меню (відкрите
 * чи закрите) вирівнює сам потік стовпчика.
 */
type Slot = {el: HTMLElement | null; setEl: (el: HTMLElement | null) => void};

const SlotContext = createContext<Slot>({el: null, setEl: () => {}});

export const SongMenuSlotProvider = ({children}: {children: React.ReactNode}) => {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({el, setEl}), [el]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
};

/** Сам слот — останній у стовпчику меню (`SongControls`). */
export const SongMenuSlot = () => {
  const {setEl} = useContext(SlotContext);
  return <div ref={setEl} className="flex flex-col items-end" />;
};

/** Елемент слота для `createPortal`; `null`, поки меню не змонтоване. */
export const useSongMenuSlot = () => useContext(SlotContext).el;
