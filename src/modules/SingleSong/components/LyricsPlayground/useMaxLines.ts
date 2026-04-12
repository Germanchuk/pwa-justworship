import {useMemo} from "react";

export function useMaxLines() {
  // 1246 px container width for big screens = 3 col
  // 736 px container width for tablet = 2 col

  const offset = 148;

  return useMemo(() => Math.floor((window.innerHeight - offset) / 20), []);
}