// The manifest of a finished render (the service's docs/renderer-handoff.md §5): release keys,
// ayah hashes, the numbers the video shows, what read and who recited. No text.

/** The manifest the service checks (§5): releases, hashes, numbers, what read and who recited. No text. */
export function manifestOf(props, voice, qari, seconds) {
  const recited = props.kind === "verse" ? props.ayahs : (props.recite?.ayahs ?? []);
  const translation = props.kind === "verse" ? props.source.translation.release.releaseKey : (props.recite?.translation?.release?.releaseKey ?? null);
  return {
    seconds: Math.round(seconds * 100) / 100,
    voice: { engine: voice.lines.length ? voice.engine : "none", voice: voice.lines.length ? voice.voice : null },
    recitation: qari ? { recitationId: qari.recitationId, reciterName: qari.reciter.name, source: qari.source, previewOnly: qari.previewOnly } : null,
    source: {
      quran: { releaseKey: props.source.quran.releaseKey },
      translation: translation ? { releaseKey: translation } : null,
      metadataSha256: props.source.surahMetadata.sha256,
    },
    ayahs: recited.map((a) => ({ locator: a.locator, textHashSha256: a.textHashSha256 })),
    facts: props.facts,
  };
}
