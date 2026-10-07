import * as Y from "yjs";
import {HocuspocusProvider} from "@hocuspocus/provider";

import {COLLAB_URL} from "#utils/serviceUrls";

export type Room = {
  bandId: string;
  provider: HocuspocusProvider;
  doc: Y.Doc;
};

type RoomListener = (room: Room | null) => void;
type OnlineListener = (online: boolean) => void;

/**
 * Кімната гурту (`band:<bandId>` у collab-сервісі): один WebSocket на
 * застосунок, незалежний від кімнат пісень. Нею користуються двоє:
 *
 * - **awareness** — звук гурту: команди хосту і статус хоста
 *   (`BandAudioChannel`). Ефемерно свідомо: після reload реплею старих
 *   команд немає;
 * - **спільний документ** — автоскрол (`autoscrollChannel`). Йому потрібно
 *   пережити відхід ініціатора, а awareness зникає разом із пристроєм.
 *   Сервер цей документ у базу не пише: коли з кімнати йде останній,
 *   документ зникає, тож старий автоскрол до наступного служіння не доживе.
 *
 * Синглтон, а не контекст: кнопки живуть і поза band-роутами (нижній бар,
 * меню пісні), контекст туди не дістає. Підключенням керує `BandRoomBridge`
 * у `BandLayout`.
 */
class BandRoom {
  static instance: BandRoom;

  private room: Room | null = null;
  private online = false;
  private roomListeners = new Set<RoomListener>();
  private onlineListeners = new Set<OnlineListener>();

  static getInstance = () => {
    BandRoom.instance ??= new BandRoom();
    return BandRoom.instance;
  };

  connect(bandId: string | number) {
    if (this.room?.bandId === String(bandId)) return;
    this.disconnect();

    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: `band:${bandId}`,
      document: doc,
      token: localStorage.getItem("authToken") ?? "",
    });
    provider.on("status", this.updateOnline);
    provider.on("synced", this.updateOnline);

    this.room = {bandId: String(bandId), provider, doc};
    this.roomListeners.forEach((listener) => listener(this.room));
    this.updateOnline();
  }

  disconnect() {
    const room = this.room;
    if (!room) return;
    // Спершу відпускаємо слухачів — вони відписуються від ще живого провайдера.
    this.room = null;
    this.roomListeners.forEach((listener) => listener(null));
    room.provider.off("status", this.updateOnline);
    room.provider.off("synced", this.updateOnline);
    room.provider.destroy();
    room.doc.destroy();
    this.updateOnline();
  }

  getBandId() {
    return this.room?.bandId ?? null;
  }

  /** Поточна кімната зараз і на кожну зміну (вхід у гурт, вихід, інший гурт). */
  onRoom(listener: RoomListener) {
    this.roomListeners.add(listener);
    listener(this.room);
    return () => {
      this.roomListeners.delete(listener);
    };
  }

  /** Чи є звʼязок із сервером і документ кімнати синхронізований. */
  isOnline() {
    return this.online;
  }

  onOnline(listener: OnlineListener) {
    this.onlineListeners.add(listener);
    return () => {
      this.onlineListeners.delete(listener);
    };
  }

  private updateOnline = () => {
    const provider = this.room?.provider;
    const online = !!provider && provider.status === "connected" && provider.synced;
    if (online === this.online) return;
    this.online = online;
    this.onlineListeners.forEach((listener) => listener(online));
  };
}

export default BandRoom;
