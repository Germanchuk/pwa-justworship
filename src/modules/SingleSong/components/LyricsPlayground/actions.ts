import store from "#/store";
import { setSections } from "../../redux/songSlice";
import parseValueToSections, {SectionFromInputValue} from "#utils/parseValueToSections";
import diffSections from "#utils/diffSections";

const history: any = [];
let historyIndex = -1;

export const syncValueWithSections = (newValue) => {
  // const inputType = (e.nativeEvent as InputEvent).inputType;
  const rawText = newValue;

  // if (inputType === 'historyUndo') {
  //   if (historyIndex > 0) {
  //     historyIndex -= 1;
  //     const snapshot = history[historyIndex];
  //     store.dispatch(setSections(snapshot.sections));
  //   }
  //   return;
  // }

  // if (inputType === 'historyRedo') {
  //   if (historyIndex < history.length - 1) {
  //     historyIndex += 1;
  //     const snapshot = history[historyIndex];
  //     store.dispatch(setSections(snapshot.sections));
  //   }
  //   return;
  // }

  const state = store.getState();
  const oldSections = state.song.song.sections || [];
  console.log("rawText", rawText);

  // do parse input.value to sections from scratch to compare with existed sections:
  const latestSections: SectionFromInputValue[] = parseValueToSections(rawText);
  console.log("latestSections", latestSections);
  // extract content to array
  const latestContent = latestSections.map((p) => p.content);

  const updatedSections = diffSections(oldSections, latestContent).map(
    (section, idx) => ({
      ...section,
      spacing: latestSections[idx]?.spacing ?? section.spacing ?? 2,
    }),
  );

  store.dispatch(setSections(updatedSections));

  history.splice(historyIndex + 1);
  history.push({ text: rawText, sections: updatedSections });
  historyIndex = history.length - 1;
}