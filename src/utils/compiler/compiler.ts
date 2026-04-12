export interface ContentBlock {
  id: string;
  title?: string;
  content: string;
}

export interface SongObject {
  name: string;
  blocks: ContentBlock[];
}

function rawTextToSongObject(rawText): Partial<SongObject> {
  const blocks: string[] = rawText.split(/\n{2,}/);

  const songOutput: Partial<SongObject> = {};

  songOutput.name = "Тестове імʼя";
// @ts-ignore
  songOutput.blocks = blocks.map((textBlock) => {
    let title;
    const linesArray = textBlock.split("\n");
    // if (isSongStructureItem(linesArray[0])) {
    //   title = linesArray.shift();
    // }

    return {
      title,
      content: linesArray.join("\n"),
    };
  });

  return songOutput as SongObject;
}


export { rawTextToSongObject };
