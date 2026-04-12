export function isSongStructureLine(str) {
  // Normalize the input to lowercase and trim any extra spaces
  const input = str.trim().toLowerCase();

  // Define arrays of possible song structure terms in English and Ukrainian
  const songStructureItems = [
    "verse", "chorus", "bridge", "intro", "instrumental", "tag", "outro",
    "ver", "ch", "br", "in", "out", // common abbreviations in English
    "куплет", "приспів", "міст", "вступ", "кінцівка",
    "куп", "пр", "мі", "вс", "кін", // common abbreviations in Ukrainian
  ];

  // Create a regex to match any of the items as whole words.
  // The `\b` is a word boundary. This prevents matching "in" inside "dawning".
  const regex = new RegExp(`\\b(${songStructureItems.join('|')})\\b`);

  // Check if the input matches any of the song structure items as a whole word.
  return regex.test(input);
}