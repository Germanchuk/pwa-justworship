import type * as Y from "yjs";

import type {Room} from "#modules/Band/room/bandRoom";
import BandRoom from "#modules/Band/room/bandRoom";

import {parseRun, sameRun, type AutoscrollRun} from "../../autoscroll/run";

/**
 * Цей пристрій як ініціатор (`SCROLL-27`): ініціатор — пристрій, а не
 * людина. Живе, доки живе сторінка: перезавантаження — новий пристрій
 * (свідомо, тікет 05). Не `crypto.randomUUID`: його немає поза HTTPS, а
 * телефон на репетиції відкриває dev-сервер за LAN-адресою.
 */
export const DEVICE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Мапа спільного документа кімнати гурту: id пісні → запис автоскролу. */
const MAP = "autoscroll";

/**
 * Автоскроли гурту — по запису на пісню (`SCROLL-12`) у спільному документі
 * кімнати гурту (`BandRoom`). Не в awareness: запис мусить пережити відхід
 * ініціатора.
 *
 * Запис пишуть двічі — старт і стоп; позицію кожен рахує сам (`run.ts`).
 */
class AutoscrollChannel {
  static instance: AutoscrollChannel;

  private map: Y.Map<unknown> | null = null;
  /**
   * Розібрані записи. Тримаємо готові обʼєкти, щоб `get` віддавав той самий
   * обʼєкт, доки запис не змінився, — цього вимагає `useSyncExternalStore`.
   */
  private runs = new Map<string, AutoscrollRun>();
  private listeners = new Set<() => void>();

  static getInstance = () => {
    if (!AutoscrollChannel.instance) {
      AutoscrollChannel.instance = new AutoscrollChannel();
      BandRoom.getInstance().onRoom(AutoscrollChannel.instance.attach);
    }
    return AutoscrollChannel.instance;
  };

  get(songId: string | number): AutoscrollRun | null {
    return this.runs.get(String(songId)) ?? null;
  }

  start(songId: string | number, run: AutoscrollRun) {
    this.map?.set(String(songId), run);
  }

  stop(songId: string | number) {
    this.map?.delete(String(songId));
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private attach = (room: Room | null) => {
    this.map?.unobserve(this.read);
    this.map = room?.doc.getMap(MAP) ?? null;
    this.map?.observe(this.read);
    this.read();
  };

  private read = () => {
    const next = new Map<string, AutoscrollRun>();
    this.map?.forEach((value, songId) => {
      const run = parseRun(value);
      if (!run) return;
      const previous = this.runs.get(songId);
      next.set(songId, previous && sameRun(previous, run) ? previous : run);
    });
    this.runs = next;
    this.listeners.forEach((listener) => listener());
  };
}

export default AutoscrollChannel;
