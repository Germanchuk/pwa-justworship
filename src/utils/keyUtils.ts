import * as Transposer from "chord-transposer";
import XRegExp from "xregexp";


// Regex for recognizing chords
const TRIAD_PATTERN = "(M|maj|major|m|min|minor|dim|sus|dom|aug|\\+|-)";
const ADDED_TONE_PATTERN = "(\\(?([/\\.\\+]|add)?[#b]?\\d+[\\+-]?\\)?)";
const SUFFIX_PATTERN = `(?<suffix>\\(?${TRIAD_PATTERN}?${ADDED_TONE_PATTERN}*\\)?)`;
const BASS_PATTERN = "(\\/(?<bass>[A-G](#|b)?))?";

export const ROOT_PATTERN = "(?<root>[A-G](#|b)?)";

const CHORD_REGEX = XRegExp(
  `^${ROOT_PATTERN}${SUFFIX_PATTERN}${BASS_PATTERN}$`
);

export function isChord(token: string): boolean {
  return CHORD_REGEX.test(token);
}

export const keys = [
  "A",
  "Asharp",
  "B",
  "C",
  "Csharp",
  "D",
  "Dsharp",
  "E",
  "F",
  "Fsharp",
  "G",
  "Gsharp",
];

export function transpose(mainKey, transposition) {
  const index = keys.findIndex((key) => key === mainKey);

  // Враховуємо кругову природу ключів
  const newIndex = (index + keys.length - transposition) % keys.length;

  return keys[newIndex];
}

export function deriveTranspositionFromKey(desiredKey, rootKey) {
  // Find the index of the main key and target key
  const keyIndex = keys.findIndex((key) => key === rootKey);
  const targetKeyIndex = keys.findIndex((key) => key === desiredKey);

  // Calculate the transposition (positive only)
  const transposition = (targetKeyIndex - keyIndex + keys.length) % keys.length;

  return transposition;
}

export function transposeLine(line, oldKey, newKey) {

  // Зберігаємо початкові пробіли за допомогою регулярного виразу
  const chordsWithSpaces = line.match(/(\S+|\s+)/g);

  const transposedChords = chordsWithSpaces.map((token) => {
    // Перевіряємо, чи це акорд чи пробіли
    const isChord = !/^[\s]*$/.test(token);

    if (isChord) {
      console.log(token);
      return Transposer.transpose(token).fromKey(oldKey.replace("sharp", "#")).toKey(newKey.replace("sharp", "#")).toString();
    } else {
      // Повертаємо пробіли без змін
      return token;
    }
  });

  // Об'єднуємо результати в рядок
  return transposedChords.join("");
}

export function isChordsLine(line) {
  const str = line.replace(/[|.]/g, " ");
  // Regular expression for matching chord patterns
  // I'm trying to decommission it (to be removed if everything is fine)
  // const chordRegex =
  //   /\b(?:G,C,D|A,B,C|E,C,D)|(?:[ABCDEFG](?:#|b)?)(?:\/[ABCDEFG]b)?(?:(?:(?:maj|min|sus|add|aug|dim)(?:\d{0,2}(?:#\d{1,2}|sus\d)?)?)|(?:m\d{0,2}(?:(?:maj|add|#)\d{0,2})?)|(?:-?\d{0,2}(?:\([^)]*\)|#\d{1,2})?))?/;

  // Split the string by spaces and check if each part matches the chord pattern
  const chords = str.trim().split(/\s+/);

  // Test each chord in the string against the chord regex
  return chords.every(isChord);
}

export function isChordsLine2(line) {
  // decommission process ongoing
  return line.split(/(\s+|-|]|\[)/g)?.reduce((result, currentValue) => {
    if (isChord(currentValue)) {
      return true;
    } else {
      return result;
    }
  }, false);
}

export function remapChords(content, oldKey, newKey) {
  const updatedContent = content.map((section) => ({
    content: section.content
      .split("\n")
      .map((line) => {
        if (isChordsLine(line)) {
          return transposeLine(line, oldKey, newKey);
        }
        return line;
      })
      .join("\n"),
  }));

  return updatedContent;
}
