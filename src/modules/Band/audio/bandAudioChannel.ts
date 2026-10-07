import type {Room} from "../room/bandRoom";
import BandRoom from "../room/bandRoom";

import type {AudioHostStatus, PlaybackCommand} from "./types";

type HostStatusListener = (status: AudioHostStatus | null) => void;
type CommandListener = (command: PlaybackCommand) => void;

/**
 * Звук гурту в кімнаті гурту (`BandRoom`): команди програвання і статус
 * хоста звуку. Усе — через awareness кімнати.
 *
 * Чому синглтон, а не контекст: кнопки служіння живуть у верхньому барі —
 * НАД band-роутами, контекст туди не дістає (той самий паттерн, що
 * DronePlayer). Підключенням керує кімната гурту.
 */
class BandAudioChannel {
  static instance: BandAudioChannel;

  private room: Room | null = null;

  private hostStatus: AudioHostStatus | null = null;
  private hostListeners = new Set<HostStatusListener>();
  private commandListeners = new Set<CommandListener>();
  /** Останній виконаний nonce по кожному peer-у — захист від повторів. */
  private seenNonces = new Map<number, number>();
  private commandNonce = 0;

  static getInstance = () => {
    if (!BandAudioChannel.instance) {
      BandAudioChannel.instance = new BandAudioChannel();
      BandRoom.getInstance().onRoom(BandAudioChannel.instance.attach);
    }
    return BandAudioChannel.instance;
  };

  private attach = (room: Room | null) => {
    this.room?.provider.awareness?.off("change", this.handleAwarenessChange);
    this.room = room;
    this.seenNonces.clear();
    if (!room) {
      this.setHostStatus(null);
      return;
    }

    // Свіжопідключений peer бачить у awareness старі команди інших — вони вже
    // виконані або протухли. Запам'ятовуємо їх як «бачені», не виконуючи.
    this.seedSeenNonces();
    room.provider.awareness?.on("change", this.handleAwarenessChange);
    this.handleAwarenessChange();
  };

  getHostStatus() {
    return this.hostStatus;
  }

  onHostStatus(listener: HostStatusListener) {
    this.hostListeners.add(listener);
    listener(this.hostStatus);
    return () => {
      this.hostListeners.delete(listener);
    };
  }

  /** Для хоста: підписка на свіжі команди (старі, бачені до підключення, не летять). */
  onCommand(listener: CommandListener) {
    this.commandListeners.add(listener);
    return () => {
      this.commandListeners.delete(listener);
    };
  }

  sendCommand(command: Omit<PlaybackCommand, "nonce" | "issuedAt">) {
    const awareness = this.room?.provider.awareness;
    if (!awareness) return;
    this.commandNonce += 1;
    const full: PlaybackCommand = {
      ...command,
      nonce: this.commandNonce,
      issuedAt: Date.now(),
    };
    awareness.setLocalStateField("playbackCommand", full);
  }

  /** Для хоста: опублікувати (або зняти — null) свій статус у кімнату. */
  publishHostStatus(status: AudioHostStatus | null) {
    this.room?.provider.awareness?.setLocalStateField("audioHost", status ?? null);
  }

  /**
   * Скільки peer-ів зараз публікують статус хоста. >1 — дубль (той самий
   * акаунт відкрив режим хоста на двох пристроях) — привід для попередження.
   */
  countPublishingHosts(): number {
    const states = this.room?.provider.awareness?.getStates();
    if (!states) return 0;
    let count = 0;
    states.forEach((state) => {
      if (state?.audioHost) count += 1;
    });
    return count;
  }

  private seedSeenNonces() {
    const states = this.room?.provider.awareness?.getStates();
    if (!states) return;
    states.forEach((state, clientId) => {
      const command = state?.playbackCommand as PlaybackCommand | undefined;
      if (command?.nonce != null) this.seenNonces.set(clientId, command.nonce);
    });
  }

  private handleAwarenessChange = () => {
    const states = this.room?.provider.awareness?.getStates();
    if (!states) {
      this.setHostStatus(null);
      return;
    }

    // Статус хоста: якщо публікують кілька (дубль-сесія) — беремо найсвіжіший.
    let freshest: AudioHostStatus | null = null;
    states.forEach((state) => {
      const status = state?.audioHost as AudioHostStatus | undefined;
      if (!status) return;
      if (!freshest || (status.updatedAt ?? 0) > (freshest.updatedAt ?? 0)) {
        freshest = status;
      }
    });
    this.setHostStatus(freshest);

    // Команди: виконуємо лише свіжіші за бачені, свої — ніколи.
    const myClientId = this.room?.doc.clientID;
    states.forEach((state, clientId) => {
      if (clientId === myClientId) return;
      const command = state?.playbackCommand as PlaybackCommand | undefined;
      if (command?.nonce == null) return;
      const seen = this.seenNonces.get(clientId) ?? -1;
      if (command.nonce <= seen) return;
      this.seenNonces.set(clientId, command.nonce);
      this.commandListeners.forEach((listener) => listener(command));
    });
  };

  private setHostStatus(status: AudioHostStatus | null) {
    const changed = JSON.stringify(status) !== JSON.stringify(this.hostStatus);
    this.hostStatus = status;
    if (changed) {
      this.hostListeners.forEach((listener) => listener(status));
    }
  }
}

export default BandAudioChannel;
