import {createContext} from "react";

export interface PlayerHighlightValue {
  currentTokenKey: string | null;
  selectedTokenKey: string | null;
}

export const PlayerHighlightContext = createContext<PlayerHighlightValue>({
  currentTokenKey: null,
  selectedTokenKey: null,
});
