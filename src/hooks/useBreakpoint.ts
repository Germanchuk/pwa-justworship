import {Breakpoints} from "../models/breakpoints";
import {useEffect, useState} from "react";

export function useBreakpoint(breakpoint: Breakpoints): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= breakpoint : false
  );

  useEffect(() => {
    function handleResize() {
      setMatches(window.innerWidth >= breakpoint);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return matches;
}
