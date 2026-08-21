import { describe, expect, it } from "vitest";

import {
  hostAwaitingPoint,
  hostNeedleFor,
  hostStateFor,
  isSameTarget,
  needleFor,
  routeFor,
} from "./hostView";
import { gatheringTarget, songTarget, type AudioHostStatus } from "./types";

const host = (patch: Partial<AudioHostStatus> = {}): AudioHostStatus => ({
  userId: 1,
  username: "пульт",
  armed: true,
  state: "playing",
  playing: songTarget(7),
  playingName: "Пісня",
  currentTokenKey: "0:1:2",
  awaitingAt: null,
  controlledBy: null,
  updatedAt: 0,
  ...patch,
});

describe("isSameTarget — тотожність без точки старту", () => {
  it("та сама пісня, різні акорди старту — те саме", () => {
    expect(isSameTarget(songTarget(7, "0:1:2"), songTarget(7))).toBe(true);
  });

  it("те саме служіння, різні пункти старту — те саме", () => {
    expect(isSameTarget(gatheringTarget(3, "p5"), gatheringTarget(3))).toBe(true);
  });

  it("число й рядок в id — той самий об'єкт (id їздить по мережі як завгодно)", () => {
    expect(isSameTarget(songTarget("7"), songTarget(7))).toBe(true);
  });

  it("пісня й зібрання ніколи не збігаються", () => {
    expect(isSameTarget(songTarget(7), gatheringTarget(7))).toBe(false);
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
    expect(hostStateFor(host({ state: "paused" }), songTarget(7))).toBe("paused");
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

  it("зібрання впізнається так само, як пісня", () => {
    expect(
      hostStateFor(host({ playing: gatheringTarget(3, "p2") }), gatheringTarget(3)),
    ).toBe("playing");
  });
});

describe("hostNeedleFor — спільна голка", () => {
  it("хост грає моє — беру його акорд", () => {
    expect(hostNeedleFor(host(), songTarget(7))).toBe("0:1:2");
  });

  it("хост грає чуже — не світиться нічого", () => {
    expect(hostNeedleFor(host(), songTarget(8))).toBe(null);
  });

  it("у зібранні голка приходить з ознакою пункту й такою й лишається", () => {
    const status = host({ playing: gatheringTarget(3), currentTokenKey: "p2:0:1:3" });

    expect(hostNeedleFor(status, gatheringTarget(3))).toBe("p2:0:1:3");
  });

  it("не озброєний хост голки не дає", () => {
    expect(hostNeedleFor(host({ armed: false }), songTarget(7))).toBe(null);
  });
});

describe("needleFor — мій показ сильніший за хостовий (`PLAY-33`)", () => {
  it("граю локально — світиться моє", () => {
    const needle = needleFor({
      localState: "playing",
      localTokenKey: "0:0:0",
      status: host(),
      target: songTarget(7),
    });

    expect(needle).toBe("0:0:0");
  });

  it("граю локально й саме зараз пауза в акордах — хостове НЕ проступає", () => {
    const needle = needleFor({
      localState: "playing",
      localTokenKey: null,
      status: host(),
      target: songTarget(7),
    });

    expect(needle).toBe(null);
  });

  it("локально тиша — світиться хостове", () => {
    const needle = needleFor({
      localState: "idle",
      localTokenKey: null,
      status: host(),
      target: songTarget(7),
    });

    expect(needle).toBe("0:1:2");
  });

  it("екран ще не знає, що на ньому відкрито — хостове не позичаємо", () => {
    const needle = needleFor({
      localState: "idle",
      localTokenKey: null,
      status: host(),
      target: null,
    });

    expect(needle).toBe(null);
  });

  it("ні хоста, ні свого звуку — нічого", () => {
    const needle = needleFor({
      localState: "idle",
      localTokenKey: null,
      status: null,
      target: songTarget(7),
    });

    expect(needle).toBe(null);
  });
});

describe("hostAwaitingPoint — на чому служіння на хості чекає «продовжити»", () => {
  const gathering = gatheringTarget(3);

  it("хост стоїть у моєму служінні — кнопка моя, і на тому самому пункті", () => {
    expect(
      hostAwaitingPoint(
        host({ playing: gatheringTarget(3, "p2"), awaitingAt: "p2" }),
        gathering,
      ),
    ).toBe("p2");
  });

  it("хост чекає в ЧУЖОМУ служінні — не моя справа", () => {
    expect(
      hostAwaitingPoint(host({ playing: gatheringTarget(9), awaitingAt: "p2" }), gathering),
    ).toBe(null);
  });

  it("хост грає моє, але не чекає — кнопки немає", () => {
    expect(
      hostAwaitingPoint(host({ playing: gatheringTarget(3), awaitingAt: null }), gathering),
    ).toBe(null);
  });

  it("хоста немає або він не озброєний — чекати нема кому", () => {
    expect(hostAwaitingPoint(null, gathering)).toBe(null);
    expect(
      hostAwaitingPoint(
        host({ armed: false, playing: gatheringTarget(3), awaitingAt: "p2" }),
        gathering,
      ),
    ).toBe(null);
  });

  it("старий хост без цього поля — просто не чекає", () => {
    const legacy = host({ playing: gatheringTarget(3) });
    delete legacy.awaitingAt;
    expect(hostAwaitingPoint(legacy, gathering)).toBe(null);
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

  it("моя зупинка на примітці — це теж мій звук", () => {
    expect(routeFor({ localState: "paused", status: host() })).toBe("local");
  });

  it("я ще вантажу семпли — це вже мій звук, хост його не забирає", () => {
    // Інакше «зупинити» пішло б на хост, а звук за секунду піднявся б ТУТ — і
    // спинити його не було б чим.
    expect(routeFor({ localState: "loading", status: host() })).toBe("local");
  });
});
