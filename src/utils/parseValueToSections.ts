export interface SectionFromInputValue {
  content: string;
  /** Number of newline characters immediately following this section */
  spacing: number;
}

/**
 * Convert textarea contents into an array of sections. Two or more
 * consecutive newlines denote the boundary between sections. The number of
 * newlines encountered is stored in the `spacing` field so blank lines can be
 * preserved when reconstructing the text later.
 */
export default function parseValueToSections(rawText: string): SectionFromInputValue[] {
  const result: SectionFromInputValue[] = [];
  let buffer = "";

  // Temporarily trim trailing newlines and handle them separately to ensure they are always preserved.
  let trailingNewlines = "";
  const match = rawText.match(/(\n*)$/);
  if (match) {
    trailingNewlines = match[1] || "";
  }
  const mainText = rawText.slice(0, rawText.length - trailingNewlines.length);

  // Run the original parsing logic on the main text without trailing newlines.
  for (let i = 0; i < mainText.length; ) {
    if (mainText[i] !== "\n") {
      buffer += mainText[i];
      i += 1;
      continue;
    }

    let j = i;
    while (j < mainText.length && mainText[j] === "\n") j += 1;
    const count = j - i;

    if (count >= 2) {
      result.push({ content: buffer, spacing: count });
      buffer = "";
    } else {
      buffer += "\n";
    }

    i = j;
  }

  // Push the final buffer content as a section.
  if (buffer.length > 0 || result.length === 0) {
    result.push({ content: buffer, spacing: 0 });
  }

  // Now, append the preserved trailing newlines to the content of the last section.
  if (result.length > 0 && trailingNewlines.length > 0) {
    result[result.length - 1].content += trailingNewlines;
  }

  return result;
}
