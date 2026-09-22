import {describe, expect, it} from "vitest";
import {
  analyzeBars,
  chordLineToProgressionMapWithKeys,
  findBarDivisionIssues,
  findSilentTails,
  isCleanDivision,
} from "./chordLineToProgressionMapWithKeys";
import {isRest, songProgression} from "./progression";
import {INCOMPLETE_BAR_MARK, SILENCE_MARK} from "#utils/chordSyntax";

/**
 * Модель часу (див. `songDefaults`): одиниця — доля, тобто одиниця знаменника,
 * і BPM рахує саме її. Такт триває стільки долей, скільки каже чисельник, а
 * написане в ньому ділить цю тривалість порівну. Ці тести тримають обидві
 * домовленості — без них 6/8 «лагодять» назад у чверті, а масштабований такт
 * назад у буквальний лік.
 */

const song = (timeSignature: [number, number], ...chordLines: string[]) =>
  songProgression(
    [
      {
        type: "section",
        children: chordLines.map((text) => ({
          type: "chord-line",
          children: [{text}],
        })),
      },
    ] as never,
    timeSignature[0],
  );

const durations = (line: string, num: number) =>
  chordLineToProgressionMapWithKeys(line, 0, 0, num).map((e) => [e.chord, e.duration]);

describe("такт триває один розмір, хай там що написано всередині", () => {
  it("однакова тривалість при будь-якій роздільності", () => {
    // саме те, чого хотів Герман: | C | = | C . . . | = | C . . . . . . . |
    const total = (line: string) =>
      chordLineToProgressionMapWithKeys(line, 0, 0, 4).reduce((s, e) => s + e.duration, 0);
    expect(total("| C |")).toBe(4);
    expect(total("| C . . . |")).toBe(4);
    expect(total("| C . . . . . . . |")).toBe(4);
    expect(total("| C G |")).toBe(4);
  });

  it("вісім слотів у 4/4 — це вісімки", () => {
    expect(durations("| C . . . . . . Em |", 4)).toEqual([
      ["C", 3.5],
      ["Em", 0.5],
    ]);
  });

  it("шістнадцять слотів — шістнадцяті", () => {
    const [first] = chordLineToProgressionMapWithKeys(`| C ${". ".repeat(15)}|`, 0, 0, 4);
    expect(first.duration).toBe(4);
    const two = durations(`| C ${". ".repeat(14)}Em |`, 4);
    expect(two).toEqual([
      ["C", 3.75],
      ["Em", 0.25],
    ]);
  });

  it("розмір задає тривалість такту, а не роздільність", () => {
    expect(durations("| C |", 6)).toEqual([["C", 6]]);
    expect(durations("| C . . . . . |", 6)).toEqual([["C", 6]]);
    // дванадцять слотів у 6/8 — по шістнадцятій
    expect(durations("| C . . . . . . . . . . G |", 6)).toEqual([
      ["C", 5.5],
      ["G", 0.5],
    ]);
  });

  it("крапка додає слот тому, що звучить", () => {
    expect(durations("| C . G . |", 4)).toEqual([
      ["C", 2],
      ["G", 2],
    ]);
    expect(durations("| C . . G |", 4)).toEqual([
      ["C", 3],
      ["G", 1],
    ]);
  });

  it("тиша — такий самий слот", () => {
    expect(durations("| C . _ . |", 4)).toEqual([
      ["C", 2],
      ["_", 2],
    ]);
    expect(durations("| C _ |", 4)).toEqual([
      ["C", 2],
      ["_", 2],
    ]);
  });
});

describe("такт читається самостійно", () => {
  it("крапка на початку такту не тягне акорд через риску — це тиша", () => {
    expect(durations("| C . . . | . . . Em |", 4)).toEqual([
      ["C", 4],
      [null, 3],
      ["Em", 1],
    ]);
  });

  it("акорд на два такти пишуть у кожному", () => {
    expect(durations("| C . . . | C . . . |", 4)).toEqual([
      ["C", 4],
      ["C", 4],
    ]);
  });
});

describe("чистий поділ", () => {
  it("ціле число долей на слот або доля, поділена навпіл", () => {
    // 4/4: ціла, половинні, чверті, вісімки, шістнадцяті
    [1, 2, 4, 8, 16].forEach((n) => expect(isCleanDivision(n, 4)).toBe(true));
    // тріолі й квінтолі — майже завжди забута крапка
    [3, 5, 6, 7].forEach((n) => expect(isCleanDivision(n, 4)).toBe(false));
  });

  it("у 3/4 чистими є 1, 3, 6, 12", () => {
    [1, 3, 6, 12].forEach((n) => expect(isCleanDivision(n, 3)).toBe(true));
    [2, 4, 5, 8].forEach((n) => expect(isCleanDivision(n, 3)).toBe(false));
  });

  it("у 6/8 дві великі долі теж чисті", () => {
    [1, 2, 3, 6, 12, 24].forEach((n) => expect(isCleanDivision(n, 6)).toBe(true));
    [4, 5, 7, 8].forEach((n) => expect(isCleanDivision(n, 6)).toBe(false));
  });
});

describe("підсвітка нечистого поділу", () => {
  const off = (line: string, num: number) =>
    findBarDivisionIssues(line, num).map((b) => b.tokens.length);

  it("чисті поділи претензій не викликають", () => {
    expect(off("| C . . . |", 4)).toEqual([]);
    expect(off("| C |", 4)).toEqual([]);
    expect(off("| C G |", 4)).toEqual([]);
    expect(off("| C . . . . . . Em |", 4)).toEqual([]);
  });

  it("забута крапка ловиться — три слоти в 4/4", () => {
    expect(off("| C . . |", 4)).toEqual([3]);
    expect(off("| A/C# E A |", 4)).toEqual([3]);
  });

  it("розмір пісні вирішує, що чисте", () => {
    expect(off("| C . . |", 3)).toEqual([]);
    expect(off("| C . . . |", 3)).toEqual([4]);
  });

  it("позначений такт перевіряється так само — `!` теж слот", () => {
    const slots = (line: string) => findBarDivisionIssues(line, 4).map((b) => b.slotCount);
    expect(slots("| C . ! . |")).toEqual([]); // чотири слоти — чисто
    expect(slots("| C . ! |")).toEqual([3]); // три — тріоль, підсвічено
  });

  it("проблему показуємо на всьому такті — від риски до риски", () => {
    const line = "| C . . | G . . . |";
    const [bad] = findBarDivisionIssues(line, 4);
    expect(line.slice(bad.charStart, bad.charEnd)).toBe("| C . . |");
  });

  it("межі беруться саме того такту, що завинив", () => {
    const line = "| C . . . | G . . |";
    const [bad] = findBarDivisionIssues(line, 4);
    expect(line.slice(bad.charStart, bad.charEnd)).toBe("| G . . |");
  });

  it("незакритий такт тягнеться до останнього свого токена", () => {
    const line = "| C . . . | G . .";
    const [bad] = findBarDivisionIssues(line, 4);
    expect(line.slice(bad.charStart, bad.charEnd)).toBe("| G . .");
  });

  it("нечистий поділ усе одно звучить — підсвітка не втручається", () => {
    // три слоти в 4/4 = тріолі; сумарно такт лишається повним
    const total = chordLineToProgressionMapWithKeys("| C . . |", 0, 0, 4).reduce(
      (s, e) => s + e.duration,
      0,
    );
    expect(total).toBe(4);
  });
});

describe("вкорочений такт: `!` — теж слот", () => {
  const lengths = (line: string, num: number) => analyzeBars(line, num).map((b) => b.length);
  const flagged = (line: string) => findBarDivisionIssues(line, 4).length;

  it("сітку задає весь написаний такт, звучить усе до `!`", () => {
    // чотири слоти по чверті; звучать перші два
    expect(lengths("| C . ! . |", 4)).toEqual([2]);
    expect(lengths("| C ! . . |", 4)).toEqual([1]);
    expect(lengths("| C . . ! |", 4)).toEqual([3]);
  });

  it("вкорочений такт має ту саму роздільність, що й звичайний", () => {
    // вісім слотів по вісімці, звучать сім — раніше таке було неможливе
    expect(lengths("| C . . . . . . ! |", 4)).toEqual([3.5]);
    expect(durations("| C . . . . . . ! |", 4)).toEqual([["C", 3.5]]);
  });

  it("те, що після `!`, домальовує сітку, але мовчить", () => {
    expect(durations("| C . ! . |", 4)).toEqual([["C", 2]]);
    expect(durations("| C . ! Em |", 4)).toEqual([["C", 2]]);
  });

  it("позначка не здатна збрехати: займає слот, тож такт коротшає завжди", () => {
    // перевірки «мусить бути коротшим» більше не існує — вона неможлива
    expect(flagged("| C . ! . |")).toBe(0);
    expect(flagged("| C ! |")).toBe(0);
    // а от нечистий поділ ловиться як і всюди: тут п'ять слотів
    expect(flagged("| C . . . ! |")).toBe(1);
  });

  it("наступний такт починається одразу — півтакту посеред куплета", () => {
    const progression = song([4, 4], "| C . . . | F . ! . | G . . . |");
    expect(progression.map((e) => [e.chord, e.duration])).toEqual([
      ["C", 4],
      ["F", 2],
      ["G", 4],
    ]);
  });

  it("такт, обірваний на нулі, не існує", () => {
    expect(flagged("| ! . . . |")).toBe(1);
    expect(flagged("| ! |")).toBe(1);
    expect(durations("| C . . . | ! . . . |", 4)).toEqual([["C", 4]]);
  });

  it("`!` не тиша — одне значення на один символ", () => {
    expect(isRest(INCOMPLETE_BAR_MARK)).toBe(false);
    expect(isRest(SILENCE_MARK)).toBe(true);
    expect(isRest("r")).toBe(false);
  });
});

describe("крапка на початку такту — помилка", () => {
  it("їй нема чого продовжувати; тиша пишеться `_`", () => {
    expect(findBarDivisionIssues("| . . . Em |", 4)).toHaveLength(1);
    expect(findBarDivisionIssues("| _ . . Em |", 4)).toHaveLength(0);
  });

  it("ловить «мовчазний такт» — уявне продовження через риску", () => {
    const line = "| C . . . | . . . Em |";
    const issues = findBarDivisionIssues(line, 4);
    expect(issues).toHaveLength(1);
    // підкреслюється саме другий такт
    expect(line.slice(issues[0].charStart, issues[0].charEnd)).toBe("| . . . Em |");
  });

  it("звук лишається тишею — підсвітка не втручається", () => {
    expect(durations("| . . . Em |", 4)).toEqual([
      [null, 3],
      ["Em", 1],
    ]);
  });
});

describe("порожній такт — недописаний", () => {
  it("`| |` підкреслюється, і сам, і посеред рядка", () => {
    expect(findBarDivisionIssues("| |", 4)).toHaveLength(1);
    const line = "| C . . . | |";
    const issues = findBarDivisionIssues(line, 4);
    expect(issues).toHaveLength(1);
    expect(line.slice(issues[0].charStart, issues[0].charEnd)).toBe("| |");
  });

  it("`| ! |` — теж: обірваний на нулі такт не існує", () => {
    expect(findBarDivisionIssues("| ! |", 4)).toHaveLength(1);
  });

  it("часу не займає: нічого не написано — нічого не грає", () => {
    expect(durations("| C . . . | |", 4)).toEqual([["C", 4]]);
  });
});

describe("хвіст після `!` не звучить", () => {
  const silent = (line: string) => findSilentTails(line, 4).map((t) => t.token);

  it("глушиться все від позначки до кінця такту", () => {
    expect(silent("| C . ! . |")).toEqual(["!", "."]);
    expect(silent("| C . ! Em |")).toEqual(["!", "Em"]);
  });

  it("акорд після `!` мовчить, хоч і написаний", () => {
    expect(durations("| C . ! Em |", 4)).toEqual([["C", 2]]);
  });

  it("рахується по такту, а не по рядку", () => {
    expect(silent("| C . ! . | G . . . |")).toEqual(["!", "."]);
  });

  it("кілька `!` — просто слоти сітки, і наївний лік тепер збігається", () => {
    // «прибрав три долі — написав три позначки» дає рівно одну долю C
    expect(durations("| C ! ! ! |", 4)).toEqual([["C", 1]]);
    expect(durations("| C . ! ! |", 4)).toEqual([["C", 2]]);
  });
});

describe("тиша `_`", () => {
  it("цілий такт тиші", () => {
    expect(durations("| _ |", 4)).toEqual([["_", 4]]);
    expect(findBarDivisionIssues("| _ |", 4)).toEqual([]);
  });
});

describe("документ у 6/8", () => {
  it("довжина такту приходить із чисельника розміру", () => {
    const progression = song([6, 8], "| Am |", "| F . . C . . |");
    expect(progression.map((e) => e.duration)).toEqual([6, 3, 3]);
  });

  it("порожній такт подій не породжує", () => {
    expect(song([6, 8], "| |")).toEqual([]);
  });
});
