import {afterEach, describe, expect, it} from "vitest";
import {
  bindMetronome,
  getMetronomeTrim,
  getMetronomeVolumeDb,
  isMetronomeMuted,
  METRONOME_BASE_DB,
  METRONOME_TRIM_RANGE,
  metronomeTrimToDb,
  resetMetronomeTrim,
  setMetronomeTrim,
  unbindMetronome,
} from "./metronomeTrim";

afterEach(() => {
  resetMetronomeTrim();
});

const makeTick = () => ({volume: {value: 0}});

describe("metronomeTrim", () => {
  it("дефолт — базова гучність, з якою клік звучав завжди", () => {
    expect(getMetronomeTrim()).toBe(0);
    expect(getMetronomeVolumeDb()).toBe(METRONOME_BASE_DB);
  });

  it("трим додається до базової гучності", () => {
    expect(metronomeTrimToDb(-6)).toBe(METRONOME_BASE_DB - 6);
    expect(metronomeTrimToDb(6)).toBe(METRONOME_BASE_DB + 6);
  });

  it("крайнє ліво — тиша, а не найтихіше значення", () => {
    expect(metronomeTrimToDb(METRONOME_TRIM_RANGE[0])).toBe(-Infinity);
    expect(isMetronomeMuted(METRONOME_TRIM_RANGE[0])).toBe(true);
    expect(isMetronomeMuted(METRONOME_TRIM_RANGE[0] + 1)).toBe(false);
  });

  it("значення за межами діапазону притискаються", () => {
    setMetronomeTrim(100);
    expect(getMetronomeTrim()).toBe(METRONOME_TRIM_RANGE[1]);
    setMetronomeTrim(-100);
    expect(getMetronomeTrim()).toBe(METRONOME_TRIM_RANGE[0]);
    expect(getMetronomeVolumeDb()).toBe(-Infinity);
  });

  it("живий клік чує зміну одразу", () => {
    const tick = makeTick();
    bindMetronome(tick);
    expect(tick.volume.value).toBe(METRONOME_BASE_DB);

    setMetronomeTrim(-10);
    expect(tick.volume.value).toBe(METRONOME_BASE_DB - 10);

    setMetronomeTrim(METRONOME_TRIM_RANGE[0]);
    expect(tick.volume.value).toBe(-Infinity);
  });

  it("відв'язаний клік більше не чіпається, але трим лишається", () => {
    const tick = makeTick();
    bindMetronome(tick);
    setMetronomeTrim(-3);
    unbindMetronome(tick);

    setMetronomeTrim(-12);
    expect(tick.volume.value).toBe(METRONOME_BASE_DB - 3);
    expect(getMetronomeVolumeDb()).toBe(METRONOME_BASE_DB - 12);
  });
});
