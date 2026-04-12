import {createContext, useContext, useEffect, useMemo, useRef} from "react";
import type {ReactNode} from "react";
import {sectionsToLinesStream} from "../../utils/sectionsToLinesStream";
import {isChordsLine} from "#utils/keyUtils";
import {chordLineToProgressionMap} from "../../services/ChordsProgressionPlayer/getMidiFromSections/utils/chordLineToProgressionMap";
import type {ChordEvent} from "../../services/ChordsProgressionPlayer/getMidiFromSections/utils/createMidiFromProgression";

interface ChordSequenceContextValue {
  claimChordId: () => number | null;
}

const ChordSequenceContext = createContext<ChordSequenceContextValue | null>(null);

interface ChordSequenceProviderProps {
  sections: any;
  children: ReactNode;
}

export function ChordSequenceProvider({sections, children}: ChordSequenceProviderProps) {
  const chordEventIds = useMemo(() => {
    const lines = sectionsToLinesStream(sections);
    return lines
      .filter((line) => isChordsLine(line.token))
      .flatMap((line) => chordLineToProgressionMap(line) as ChordEvent[])
      .map((event, index) => ({...event, id: index}))
      .filter((event) => event.chord != null)
      .map((event) => event.id ?? 0);
  }, [sections]);

  const pointerRef = useRef(0);

  useEffect(() => {
    pointerRef.current = 0;
  }, [chordEventIds]);

  const value = useMemo<ChordSequenceContextValue>(() => ({
    claimChordId: () => {
      const id = chordEventIds[pointerRef.current];
      if (id == null) {
        return null;
      }
      pointerRef.current += 1;
      return id;
    },
  }), [chordEventIds]);

  return (
    <ChordSequenceContext.Provider value={value}>
      {children}
    </ChordSequenceContext.Provider>
  );
}

export function useChordSequenceId(): number | null {
  const context = useContext(ChordSequenceContext);
  const idRef = useRef<number | null>(null);

  if (context && idRef.current == null) {
    idRef.current = context.claimChordId();
  }

  return idRef.current;
}
