/**
 * Динаміка рядка — колір смужки біля рядка. Два шари, кожен на своїй смужці:
 *  - спільна (`dynamics`, ліворуч) — одне значення в маркері, однакове для всіх;
 *  - особиста (`dynamicsBy`, нік → колір, праворуч) — бачить лише її власник.
 * Двоє одночасно фарбують той самий рядок — лишається один колір, однаковий
 * в обох копіях; різні рядки й різні люди одне одному не заважають.
 *
 * Колір є лише у відрізка: порожній рядок і структурна примітка не
 * фарбуються, а колір, що лишився в маркері (рядок спорожнів), не видно.
 */
import * as Y from "yjs";
import { DynamicsStepKey, isDynamicsStepKey } from "./dynamicsSteps";
import { layout, lineKind } from "./read";
import type { Line, LineAt, Song } from "./song";

export type { DynamicsStepKey } from "./dynamicsSteps";
export { DYNAMICS_STEPS, getDynamicsStepColor } from "./dynamicsSteps";

/** Чия динаміка: спільна (`null`) чи особиста людини з цим ніком. */
export type DynamicsLayer = string | null;

const personalOf = (line: Line) => line.get("dynamicsBy") as Y.Map<string>;

export const dynamicsOf = (line: Line, layer: DynamicsLayer = null): DynamicsStepKey | null => {
  const key = layer === null ? line.get("dynamics") : personalOf(line).get(layer);
  return isDynamicsStepKey(key) ? key : null;
};

/** Усі особисті кольори рядка — щоб Enter віддав їх обом частинам. */
export const personalDynamicsOf = (line: Line): Record<string, DynamicsStepKey> =>
  Object.fromEntries(Object.entries(personalOf(line).toJSON()).filter(([, key]) => isDynamicsStepKey(key))) as Record<
    string,
    DynamicsStepKey
  >;

/** Колір смужки шару `layer`, який видно. Лише у відрізка. */
export const shownDynamics = (l: LineAt, layer: DynamicsLayer = null): DynamicsStepKey | null =>
  lineKind(l) === "segment" ? dynamicsOf(l.line, layer) : null;

/**
 * Пофарбувати рядки в шарі `layer` (`null` у `key` — стерти). Пропускає
 * рядки, яких уже немає в пісні, і ті, що не відрізки. Викликати в транзакції.
 */
export function paintDynamics(song: Song, lines: Line[], key: DynamicsStepKey | null, layer: DynamicsLayer = null) {
  const segments = new Set(layout(song).filter((l) => lineKind(l) === "segment").map((l) => l.line));
  lines
    .filter((line) => segments.has(line) && dynamicsOf(line, layer) !== key)
    .forEach((line) => {
      if (layer === null) {
        if (key) line.set("dynamics", key);
        else line.delete("dynamics");
      } else if (key) personalOf(line).set(layer, key);
      else personalOf(line).delete(layer);
    });
}
