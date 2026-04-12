export function chordLineToProgressionMap(chordLine, beatsPerBar = 4) {
  // does transformation from | G | to { chord: "G", duration: 4 }, etc.
  const bars = chordLine.token
    .split("|")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const out = [];

  for (const bar of bars) {
    // Розбиваємо на акорди і крапки, підтримуємо склеєні "."
    const raw = bar.split(/\s+/).filter(Boolean);
    const tokens = raw.flatMap(t => t.split(/(?=\.)|(?<=\.)/g)).filter(Boolean);

    if (tokens.length === 0) continue;

    const chordTokens = tokens.filter(t => t !== ".");

    // Спецвипадок: лише один акорд і жодної крапки → повний такт
    if (chordTokens.length === 1 && tokens.every(t => t !== ".")) {
      out.push({ chord: chordTokens[0], duration: beatsPerBar });
      continue;
    }

    // Звичайний режим: 1 токен = 1 удар
    // Важливо не продовжувати елемент через межу такту
    const startIdx = out.length;

    for (const tk of tokens) {
      if (tk === ".") {
        // якщо крапка перша в такті — створюємо тишу на 1
        if (out.length === startIdx) {
          out.push({ chord: null, duration: 1 });
        } else {
          // подовжуємо останній елемент у цьому ж такті
          out[out.length - 1].duration += 1;
        }
      } else {
        // новий акорд тривалістю 1
        out.push({ chord: tk, duration: 1 });
      }
    }
    // НІЧОГО не додаємо для "незаповнених" ударів — вони вважаються пропущеними,
    // окрім спецвипадку вище (єдиний акорд без крапок).
  }

  return out;
}
