import { describe, expect, it } from "vitest";

import { hostStateFor, isSameTarget, routeFor } from "./hostView";
import { songTarget, type AudioHostStatus } from "./types";

const host = (patch: Partial<AudioHostStatus> = {}): AudioHostStatus => ({
  userId: 1,
  username: "пульт",
  armed: true,
  state: "playing",
  playing: songTarget(7),
  playingName: "Пісня",
  controlledBy: null,
  updatedAt: 0,
  ...patch,
});

describe("isSameTarget", () => {
  it("число й рядок в id — той самий об'єкт (id їздить по мережі як завгодно)", () => {
    expect(isSameTarget(songTarget("7"), songTarget(7))).toBe(true);
  });

  it("різні пісні — різне", () => {
    expect(isSameTarget(songTarget(7), songTarget(8))).toBe(false);
  });

  it("нічого не грає — не збігається ні з чим", () => {
    expect(isSameTarget(null, songTarget(7))).toBe(false);
  });
});

describe("hostStateFor — стан хоста для ЦЬОГО екрана", () => {
  it("хост грає моє — його стан", () => {
    expect(hostStateFor(host({ state: "loading" }), songTarget(7))).toBe("loading");
  });

  it("хост грає чуже — для мене тиша", () => {
    expect(hostStateFor(host(), songTarget(8))).toBe("idle");
  });

  it("хоста немає — тиша", () => {
    expect(hostStateFor(null, songTarget(7))).toBe("idle");
  });

  it("хост онлайн, але не озброєний — його ще немає (`PLAY-27`)", () => {
    expect(hostStateFor(host({ armed: false }), songTarget(7))).toBe("idle");
  });
});

describe("routeFor — куди йдуть мої кнопки", () => {
  it("хоста немає — усе своє", () => {
    expect(routeFor({ localState: "idle", status: null })).toBe("local");
  });

  it("хост призначений, але не озброєний — усе одно своє", () => {
    expect(routeFor({ localState: "idle", status: host({ armed: false }) })).toBe("local");
  });

  it("хост живий, я мовчу — кнопки стають пультом", () => {
    expect(routeFor({ localState: "idle", status: host() })).toBe("host");
  });

  it("я вже граю — хост, що зʼявився, мене не забирає", () => {
    expect(routeFor({ localState: "playing", status: host() })).toBe("local");
  });

  it("звук ще піднімається — це вже мій звук, хост його не забирає", () => {
    // Інакше «вимкнути» пішло б на хост, а звук за мить піднявся б ТУТ — і
    // вимкнути його не було б чим.
    expect(routeFor({ localState: "loading", status: host() })).toBe("local");
  });
});
