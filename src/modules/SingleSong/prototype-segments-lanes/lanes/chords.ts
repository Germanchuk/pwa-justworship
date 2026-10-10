/**
 * Транспонування рядка акордів — лише показ, особисте (як капо).
 * Рядок акордів — простий текст; акордом вважається слово, що починається з A–G.
 */
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

export function transposeName(name: string, semis: number) {
  if (!semis) return name;
  const shift = (root: string) => {
    const i = NOTES.indexOf(FLATS[root] ?? root);
    return i < 0 ? root : NOTES[(i + semis + 120) % 12];
  };
  return name.replace(/^([A-G][#b]?)/, shift).replace(/\/([A-G][#b]?)/, (_, root: string) => "/" + shift(root));
}

/** Кожен акорд лишається на своїй колонці; довший відсуває наступний. */
export function transposeLine(line: string, semis: number) {
  if (!semis) return line;
  let out = "";
  for (const m of line.matchAll(/\S+/g)) {
    const col = Math.max(m.index!, out.length ? out.length + 1 : 0);
    out = out.padEnd(col, " ") + (/^[A-G]/.test(m[0]) ? transposeName(m[0], semis) : m[0]);
  }
  return out;
}
