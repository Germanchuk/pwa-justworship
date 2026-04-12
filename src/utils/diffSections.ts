export interface Section {
  id?: number;
  content: string;
  /**
   * Number of newline characters following this section. Optional so older
   * data without spacing information continues to work.
   */
  spacing?: number;
}

function buildLcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  return dp;
}

function extractLcs(a: string[], b: string[], dp: number[][]): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}

export function diffSections(oldSections: Section[], newContents: string[]): Section[] {
  const oldContents = oldSections.map((s) => s.content);
  const dp = buildLcsMatrix(oldContents, newContents);
  const matches = extractLcs(oldContents, newContents, dp);

  const result: Section[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let matchPointer = 0;

  const pushModifiedOrInserted = (oldSeg: Section[], newSeg: string[]) => {
    const minLen = Math.min(oldSeg.length, newSeg.length);

    for (let i = 0; i < minLen; i++) {
      result.push({ ...oldSeg[i], content: newSeg[i] });
    }

    for (let i = minLen; i < newSeg.length; i++) {
      result.push({ content: newSeg[i] });
    }
    // any remaining oldSeg items are deletions and are ignored
  };

  while (matchPointer <= matches.length) {
    const nextMatch = matches[matchPointer] || [oldSections.length, newContents.length];
    const [nextOld, nextNew] = nextMatch;

    const oldSegment = oldSections.slice(oldIndex, nextOld);
    const newSegment = newContents.slice(newIndex, nextNew);

    if (oldSegment.length || newSegment.length) {
      pushModifiedOrInserted(oldSegment, newSegment);
    }

    if (matchPointer < matches.length) {
      result.push(oldSections[nextOld]);
    }

    oldIndex = nextOld + 1;
    newIndex = nextNew + 1;
    matchPointer++;
  }

  return result;
}

export default diffSections;
