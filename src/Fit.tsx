// A block of text set as large as it can be inside a box, never larger than `max` and never
// cut: the size is found by measuring the real lines once the fonts are in (a binary search
// on the font size), before the frame is taken. Nothing in the text is changed or shortened.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { fontsReady } from "./fonts";

export const Fit: React.FC<{
  width: number;
  maxHeight: number;
  max: number;
  min: number;
  style?: React.CSSProperties;
  lang?: string;
  dir?: "rtl" | "ltr";
  /** What the size depends on (the text); the size is found again when it changes. */
  measureKey: string;
  children: React.ReactNode;
}> = ({ width, maxHeight, max, min, style, lang, dir, measureKey, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [handle] = useState(() => delayRender(`fit ${measureKey.length}`));
  const done = useRef(false);

  useLayoutEffect(() => {
    let live = true;
    void fontsReady().then(() => {
      const el = ref.current;
      if (!live || !el) return;
      let lo = min;
      let hi = max;
      let best = min;
      const fits = (px: number) => {
        el.style.fontSize = `${px}px`;
        return el.scrollHeight <= maxHeight && el.scrollWidth <= width + 1;
      };
      if (fits(max)) best = max;
      else
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) {
            best = mid;
            lo = mid;
          } else hi = mid;
        }
      setSize(Math.floor(best * 2) / 2);
    });
    return () => {
      live = false;
    };
  }, [measureKey, width, maxHeight, max, min]);

  useEffect(() => {
    if (size !== null && !done.current) {
      done.current = true;
      continueRender(handle);
    }
  }, [size, handle]);
  useEffect(
    () => () => {
      if (!done.current) {
        done.current = true;
        continueRender(handle);
      }
    },
    [handle],
  );

  return (
    <div ref={ref} lang={lang} dir={dir} style={{ width, ...style, fontSize: size ?? max, visibility: size === null ? "hidden" : "visible" }}>
      {children}
    </div>
  );
};
