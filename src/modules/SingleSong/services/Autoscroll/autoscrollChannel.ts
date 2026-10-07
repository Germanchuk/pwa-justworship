import type * as Y from "yjs";

import type {Room} from "#modules/Band/room/bandRoom";
import BandRoom from "#modules/Band/room/bandRoom";

import type {SongMode} from "../../mode";
import {initiatorPresent, parsePresence, type Presence} from "../../autoscroll/presence";
import {parseRun, sameRun, sameStart, type AutoscrollRun} from "../../autoscroll/run";

/**
 * Цей пристрій як ініціатор (`SCROLL-27`): ініціатор — пристрій, а не
 * людина. Живе, доки живе сторінка: перезавантаження — новий пристрій
 * (свідомо, тікет 05). Не `crypto.randomUUID`: його немає поза HTTPS, а
 * телефон на репетиції відкриває dev-сервер за LAN-адресою.
 */
export const DEVICE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Мапа спільного документа кімнати гурту: id пісні → запис автоскролу. */
const MAP = "autoscroll";

/** Поле awareness кімнати гурту: на якій пісні пристрій і в якому режимі. */
const PRESENCE = "presence";

type Awareness = NonNullable<Room["provider"]["awareness"]>;

/**
 * Автоскроли гурту — по запису на пісню (`SCROLL-12`) у спільному документі
 * кімнати гурту (`BandRoom`). Не в awareness: запис мусить пережити відхід
 * ініціатора.
 *
 * Запис пишуть старт, стоп і ініціатор, коли рухає гурт (дотик і
 * відпускання); позицію кожен рахує сам (`run.ts`).
 *
 * Тут же присутність (`SCROLL-8`, `SCROLL-31`): кожен пристрій каже в
 * awareness кімнати, на якій пісні він і в якому режимі, — так видно, чи
 * ініціатор ще веде. Awareness, а не документ: вона зникає разом із
 * пристроєм, а саме це й треба помітити.
 */
class AutoscrollChannel {
  static instance: AutoscrollChannel;

  private map: Y.Map<unknown> | null = null;
  private awareness: Awareness | null = null;
  /** Де цей пристрій — переживає зміну кімнати (інший гурт, перепідключення). */
  private presence: Presence | null = null;
  /** Де пристрої кімнати, цей теж. */
  private presences: Presence[] = [];
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
      // Провайдер на `pagehide` стирає мій стан awareness цілком. Сторінка,
      // що вернулась із bfcache (назад/вперед у Safari), мусить сказати про
      // себе знову — інакше ініціатор «відсутній», хоч і читає.
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) AutoscrollChannel.instance.writePresence();
      });
    }
    return AutoscrollChannel.instance;
  };

  get(songId: string | number): AutoscrollRun | null {
    return this.runs.get(String(songId)) ?? null;
  }

  start(songId: string | number, run: AutoscrollRun) {
    this.map?.set(String(songId), run);
  }

  /**
   * Ініціатор переписує запис, коли рухає гурт (`SCROLL-26`), — поверх
   * того, що є в цю мить. Автоскролу вже немає (зупинили) — нічого: запис не
   * воскресне. Змінювати нічого — `change` вертає той самий запис.
   */
  update(songId: string | number, change: (run: AutoscrollRun) => AutoscrollRun) {
    const current = this.get(songId);
    if (!current) return;
    const next = change(current);
    if (next !== current && sameStart(current, next)) this.map?.set(String(songId), next);
  }

  stop(songId: string | number) {
    this.map?.delete(String(songId));
  }

  /** Цей пристрій на пісні в режимі — чи `null`, коли пішов із пісні. */
  setPresence(at: {songId: string | number; mode: SongMode} | null) {
    this.presence = at && {device: DEVICE_ID, songId: String(at.songId), mode: at.mode};
    this.writePresence();
  }

  /** Чи ініціатор автоскролу на пісні в режимі читання. Автоскролу немає — ні. */
  isInitiatorPresent(songId: string | number): boolean {
    const run = this.get(songId);
    return run != null && initiatorPresent(run, songId, this.presences);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private attach = (room: Room | null) => {
    this.map?.unobserve(this.read);
    this.awareness?.off("change", this.readPresences);
    this.map = room?.doc.getMap(MAP) ?? null;
    this.awareness = room?.provider.awareness ?? null;
    this.map?.observe(this.read);
    this.awareness?.on("change", this.readPresences);
    this.writePresence();
    this.read();
    this.readPresences();
  };

  /**
   * Не `setLocalStateField`: той мовчки нічого не пише, коли мого стану
   * немає (після `pagehide`).
   */
  private writePresence() {
    const awareness = this.awareness;
    if (!awareness) return;
    awareness.setLocalState({...awareness.getLocalState(), [PRESENCE]: this.presence});
  }

  private readPresences = () => {
    const next: Presence[] = [];
    this.awareness?.getStates().forEach((state) => {
      const presence = parsePresence(state?.[PRESENCE]);
      if (presence) next.push(presence);
    });
    // Awareness міняється й від звуку гурту — слухачів будимо, лише коли
    // змінилась саме присутність.
    if (JSON.stringify(next) === JSON.stringify(this.presences)) return;
    this.presences = next;
    this.listeners.forEach((listener) => listener());
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
