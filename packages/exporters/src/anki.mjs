/**
 * Anki tab-separated (TSV) flashcard exporter.
 * Import directly into Anki via File -> Import (Front \t Back \t Tags).
 */

function cleanTsvField(val) {
  return String(val ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, "<br>")
    .trim();
}

export function exportFlashcardsToAnkiTsv(cards, defaultTag = "kuraso") {
  const lines = [];
  for (const card of cards) {
    const front = cleanTsvField(card.question);
    const cite = card.citation ? ` [${card.citation}]` : "";
    const back = cleanTsvField(`${card.answer}${cite}`);
    const tags = cleanTsvField((card.tags?.length ? card.tags : [defaultTag]).join(" "));
    if (front && back) {
      lines.push(`${front}\t${back}\t${tags}`);
    }
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}
