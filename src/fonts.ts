// The four faces, from public/fonts (SIL Open Font License 1.1; the licence files sit beside
// them). Every frame waits for them, and text is measured only after they are in.
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

const FACES = [
  { family: "Amiri Quran", file: "fonts/AmiriQuran-Regular.ttf", weight: "400", style: "normal" },
  { family: "Vazirmatn", file: "fonts/Vazirmatn-Variable.ttf", weight: "100 900", style: "normal" },
  { family: "EB Garamond", file: "fonts/EBGaramond-Variable.ttf", weight: "400 800", style: "normal" },
  { family: "EB Garamond", file: "fonts/EBGaramond-Italic-Variable.ttf", weight: "400 800", style: "italic" },
];

let ready: Promise<void> | null = null;

/** Resolves once every face is loaded and added to the document. */
export function fontsReady(): Promise<void> {
  if (!ready) {
    const handle = delayRender("fonts");
    ready = Promise.all(
      FACES.map(async (f) => {
        const face = new FontFace(f.family, `url('${staticFile(f.file)}') format('truetype')`, { weight: f.weight, style: f.style });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(
      () => continueRender(handle),
      (error: unknown) => cancelRender(error instanceof Error ? error : new Error("a font did not load")),
    );
  }
  return ready;
}

if (typeof document !== "undefined") void fontsReady();
