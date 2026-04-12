import classNames from "classnames";
import ChordLine from "./ChordLine/ChordLine";
import {transpose} from "chord-transposer";
import {LineType} from "#models/song";

const NormalText = ({children}) => {
  return <div className={classNames("pr-4 pl-1 whitespace-pre-wrap")}>{children}</div>;
}

const Spacing = ({index, caretPos = -1}) => (
  <div className={classNames({"pr-4 pl-1": index !== caretPos})}
       key={index}>
    <br/>
  </div>
);

const SectionHeader = ({index, children}) => (
  <div
    className="LyricsPlayground__blockTitle bg-gradient-to-br from-sky-100 from-10% via-sky-0 via-30% to-sky-0 to-90% whitespace-pre-wrap pr-4 pl-1"
    key={index}
  >
    {children}
  </div>
);

const Chords = ({children, index, transposition}) => (
  <ChordLine key={index}>
    {transposition ? transpose(children).down(transposition).toString() : children}
  </ChordLine>
);

const LineRoot = ({ children }: { children: React.ReactNode }) => {
  // never use it, it's just base
  return <div className="line-wrapper">{children}</div>;
};

// 2. Об'єднуємо Root з варіантами
export const Line = Object.assign(LineRoot, {
  [LineType.SPACING]: Spacing,
  [LineType.CHORDS]: Chords,
  [LineType.HEADER]: SectionHeader,
  [LineType.LYRICS]: NormalText,
});

// export const modifiers = [
//   {
//     internalName: "spacing",
//     detector: (line) => !line,
//     Component: (_, index, caretPos = false) => (
//       <div className={classNames({"pr-4 pl-1": index !== caretPos})}
//            key={index}>
//         <br/>
//       </div>
//     ),
//   },
//   {
//     internalName: "chords",
//     detector: (line) => isChordsLine(line),
//     Component: (line, index, transposition) => (
//       <ChordLine key={index}>
//         {transposition ? transpose(line).down(transposition).toString() : line}
//       </ChordLine>
//     ),
//   },
//   {
//     internalName: "header",
//     detector: (line, firstSectionLine) => firstSectionLine && isSongStructureLine(line),
//     Component: (line, index) => (
//       <div
//         className="LyricsPlayground__blockTitle bg-gradient-to-br from-sky-100 from-10% via-sky-0 via-30% to-sky-0 to-90% whitespace-pre-wrap pr-4 pl-1"
//         key={index}
//       >
//         {line}
//       </div>
//     ),
//   },
// ];

