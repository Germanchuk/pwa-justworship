import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
  getPlayerSettings,
  resetPlayerSettingsCache,
  subscribePlayerSettings,
  updatePlayerSettings,
} from "./playerSettings";
import {isPadPreset, getPadPresetDef, PAD_PRESETS} from "./createPad/padPresets";

// Тести бігають у node — підкладаємо мінімальний localStorage.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  resetPlayerSettingsCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playerSettings", () => {
  it("без збережень віддає дефолти", () => {
    expect(getPlayerSettings()).toEqual({
      padPreset: "classic",
      piano: true,
      pianoVolume: 0,
      humanize: "natural",
    });
  });

  it("зберігає зміни й читає їх після скидання кешу (нове завантаження)", () => {
    updatePlayerSettings({padPreset: "worship"});
    resetPlayerSettingsCache();
    expect(getPlayerSettings()).toEqual({
      padPreset: "worship",
      piano: true,
      pianoVolume: 0,
      humanize: "natural",
    });
  });

  it("сміття у storage тихо падає на дефолти", () => {
    store.set("jw.player-settings", "{не json");
    expect(getPlayerSettings().padPreset).toBe("classic");

    resetPlayerSettingsCache();
    // старий/видалений ключ пресета
    store.set("jw.player-settings", JSON.stringify({padPreset: "deleted-preset", piano: false}));
    expect(getPlayerSettings()).toMatchObject({padPreset: "classic", piano: false});
  });

  it("валідує нові поля: гучність клямпиться, невідомий рівень падає на дефолт", () => {
    store.set(
      "jw.player-settings",
      JSON.stringify({pianoVolume: -100, humanize: "extreme"}),
    );
    expect(getPlayerSettings()).toMatchObject({pianoVolume: -24, humanize: "natural"});

    resetPlayerSettingsCache();
    store.set(
      "jw.player-settings",
      JSON.stringify({pianoVolume: "loud", humanize: "loose"}),
    );
    expect(getPlayerSettings()).toMatchObject({pianoVolume: 0, humanize: "loose"});
  });

  it("недоступний localStorage не валить ані читання, ані запис", () => {
    vi.stubGlobal("localStorage", undefined);
    resetPlayerSettingsCache();
    expect(getPlayerSettings()).toMatchObject({padPreset: "classic", piano: true});
    expect(() => updatePlayerSettings({piano: false})).not.toThrow();
    expect(getPlayerSettings().piano).toBe(false);
  });

  it("сповіщає підписників і показує нове значення одразу", () => {
    const seen: string[] = [];
    const unsubscribe = subscribePlayerSettings(() => {
      seen.push(getPlayerSettings().padPreset);
    });
    updatePlayerSettings({padPreset: "warm"});
    unsubscribe();
    updatePlayerSettings({padPreset: "classic"});
    expect(seen).toEqual(["warm"]);
  });
});

describe("padPresets", () => {
  it("валідатор знає всі ключі реєстру", () => {
    PAD_PRESETS.forEach((preset) => expect(isPadPreset(preset.key)).toBe(true));
    expect(isPadPreset("deleted-preset")).toBe(false);
    expect(isPadPreset(undefined)).toBe(false);
  });

  it("невідомий ключ падає на перший пресет", () => {
    expect(getPadPresetDef("deleted-preset")).toBe(PAD_PRESETS[0]);
    expect(getPadPresetDef("worship").key).toBe("worship");
  });
});
