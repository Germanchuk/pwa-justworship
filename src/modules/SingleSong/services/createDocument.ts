import {Document, Packer, Paragraph, TextRun} from "docx";
import { saveAs } from "file-saver";
import {isChordsLine} from "#utils/keyUtils";
import {isSongStructureLine} from "#utils/structureCaptionDetector";
import store from "#/store";

export function createDocument() {
  const song = store.getState().song.song;

// Створення документа
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
          },
        },
      },
      paragraphStyles: [
        {
          id: "titleStyle",
          name: "Title Style",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            bold: true,
            size: 48, // розмір шрифту (48 half-points = 24pt)
          },
          paragraph: {
            alignment: "center",
          },
        },
        {
          id: "subtitleStyle",
          name: "Song Subtitle Style",
          basedOn: "Normal",
          next: "Normal",
          run: {
            size: 28, // 14pt
          },
          paragraph: {
            alignment: "center",
            spacing: { after: 200 },
          },
        },
        {
          id: "sectionStyle",
          name: "Song Section Style",
          basedOn: "Normal",
          next: "Normal",
          run: {
            size: 28, // 14pt
          },
          paragraph: {
            alignment: "left",
            spacing: { after: 200 },
          },
        },
        {
          id: "chordLineStyle",
          name: "Chord Line Style",
          basedOn: "Normal",
          next: "Normal",
          run: {
            size: 28, // 14pt
            bold: true,
            color: "#ff5733"
          },
          paragraph: {
            alignment: "left",
            spacing: { after: 200 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 567,    // 1 дюйм
              right: 567,  // 1 дюйм
              bottom: 567, // 1 дюйм
              left: 567,   // 1 дюйм
            },
          },
        },
        children: [
          new Paragraph({
            text: song.name,
            style: "titleStyle",
          }),
          new Paragraph({
            text: `Тональність: ${song.key} | Темп: ${song.bpm}`,
            style: "subtitleStyle",
          }),
          ...handleSections(song.sections)
        ],
      },
    ],
  });

  Packer.toBlob(doc).then(blob => {

    // Закоментований нижче код - це для превʼю друку, зараз не допрацьований
    // blob.arrayBuffer().then(buffer => {
      // Знаходимо HTML-контейнер для прев'ю
      // const previewElement = document.getElementById("preview");
      // if (previewElement) {
      //   renderAsync(buffer, previewElement, null, {inWrapper: true}).catch(err => console.error(err));
      // }
    // });

    saveAs(blob, `${song.name} (${song.key}).docx`);
  });

}

function handleSections(sections) {
  return sections.map(section => {
    return new Paragraph({
      children: [
        ...handleLines(section.content)
      ],
      keepLines: true,
      style: "sectionStyle",
    })
  })
}

function handleLines(sectionsContent) {
  return sectionsContent.split("\n").map((line, index) => {
    console.log(getStyle(line, index));
    return new TextRun({
      text: line,
      break: 1,
      ...getStyle(line, index)
    })
  })
}

function getStyle(line, index) {
  if (isChordsLine(line)) {
    return {
      color: "#ff5733",
      bold: true
    };
  }

  if (index === 0 && isSongStructureLine(line)) {
    return {
      bold: true,
      underline: {},
    };
  }

  return {};
}


