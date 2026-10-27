// The props of the templates that wait (Persian Nahj al-balagha, Kumayl, the dhikr Story, the
// short tafsir carousel, the occasion) and of the Mirror (approve-first): filled in by the
// waiting-templates worker. None of them is in the worker's CAN until its texts are served.

/** The formats this file draws (none yet). */
export const WAITING_FORMATS = new Set();

/** props/<id>.json for a waiting format (none yet). */
export async function waitingProps(job) {
  throw new Error(`${job.props?.format} is not drawn yet`);
}
