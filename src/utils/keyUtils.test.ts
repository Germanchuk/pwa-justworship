import {describe, expect, it} from "vitest";
import {isChordsLine} from "#utils/keyUtils";

/**
 * Тип рядка визначається автоматично за вмістом (`SONG-15`), і саме тут
 * ламається кожен новий символ синтаксису: додали `_` і `!` в мову акордового
 * рядка — редактор почав вважати такі рядки текстом пісні й перемальовував їх
 * як слова. Будь-яка нова позначка має потрапити і сюди.
 */
describe("тип рядка", () => {
  it("рядки з позначками синтаксису — акордові", () => {
    expect(isChordsLine("| C . _ . |")).toBe(true);
    expect(isChordsLine("| _ |")).toBe(true);
    expect(isChordsLine("| C . ! |")).toBe(true);
    expect(isChordsLine("| C . _ . | C . ! |")).toBe(true);
    expect(isChordsLine("| C G |")).toBe(true);
  });
  it("текст пісні лишається текстом", () => {
    expect(isChordsLine("Твоя доброта веде мене")).toBe(false);
    expect(isChordsLine("по-перше, це не акорд")).toBe(false);
    // знак оклику в словах не робить рядок акордовим
    expect(isChordsLine("Алілуя!")).toBe(false);
    expect(isChordsLine("! приспів двічі")).toBe(false);
    expect(isChordsLine("- приспів двічі")).toBe(false);
  });
});
