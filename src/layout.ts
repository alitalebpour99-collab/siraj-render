// Where text may stand in an insight video (S3b), shared by the compositions and the render's
// safe-frame check: every block sits inside the 4:5 feed crop (y 285–1635 of 1920) and above the
// lowest 340 px, where Instagram draws its caption. No imports, so the build scripts read it too.

export const BAND = { chip: 296, visTop: 380, visBottom: 1150, capTop: 1178, capH: 236, rule: 1440, ruleH: 110 };

/** The 4:5 crop of a 1080×1920 Reel (1080×1350 around the middle) and the caption zone. */
export const CROP = { top: (1920 - 1350) / 2, bottom: 1920 - 340 };

/** Every text block of an insight video, [top, bottom] in pixels. */
export const TEXT_BOXES: ReadonlyArray<readonly [number, number]> = [
  [BAND.chip, BAND.chip + 60],
  [BAND.visTop, BAND.visBottom],
  [BAND.capTop, BAND.capTop + BAND.capH],
  [BAND.rule, BAND.rule + BAND.ruleH],
];

/** True when every block is inside the crop and above the caption zone. */
export const safeFrame = (boxes: ReadonlyArray<readonly [number, number]> = TEXT_BOXES) => boxes.every(([a, b]) => a >= CROP.top && b <= CROP.bottom);
