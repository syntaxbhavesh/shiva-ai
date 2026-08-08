export type NoteDoc = {
  id: string;
  name: string;
  addedAt: number;
  chunks: string[];
};

const KEY = "shiva-ai-notes";

function hasWindow() {
  return typeof window !== "undefined";
}

export function loadNotes(): NoteDoc[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as NoteDoc[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.addedAt - a.addedAt) : [];
  } catch {
    return [];
  }
}

function saveNotes(docs: NoteDoc[]) {
  if (!hasWindow()) return;
  window.localStorage.setItem(KEY, JSON.stringify(docs));
}

export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += size - overlap) {
    chunks.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  return chunks;
}

export function addNote(name: string, text: string): NoteDoc {
  const doc: NoteDoc = {
    id: hasWindow() && window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()),
    name,
    addedAt: Date.now(),
    chunks: chunkText(text),
  };
  saveNotes([doc, ...loadNotes()]);
  return doc;
}

export function removeNote(id: string) {
  saveNotes(loadNotes().filter((d) => d.id !== id));
}

const STOP = new Set([
  "the","a","an","is","are","was","were","of","to","in","on","for","and","or","what","who",
  "how","why","when","this","that","it","my","me","i","do","does","can","you","from","with",
  "about","explain","tell","give","please",
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Keyword-overlap retrieval over the student's uploaded notes, with fallback. */
export function retrieveContext(query: string, topK = 6): { name: string; text: string }[] {
  const docs = loadNotes();
  if (docs.length === 0) return [];

  const terms = tokenize(query);
  const scored: { name: string; text: string; score: number }[] = [];

  for (const doc of docs) {
    const nameTerms = tokenize(doc.name);
    for (const chunk of doc.chunks) {
      const lower = chunk.toLowerCase();
      let score = 0;
      for (const term of terms) {
        const hits = lower.split(term).length - 1;
        if (hits > 0) score += 1 + Math.min(hits - 1, 3) * 0.25;
        // partial/stemmed match (e.g. "photosynthesis" vs "photosynthetic")
        else if (term.length > 4 && lower.includes(term.slice(0, Math.max(4, term.length - 2))))
          score += 0.4;
        if (nameTerms.includes(term)) score += 0.3;
      }
      if (score > 0) scored.push({ name: doc.name, text: chunk, score });
    }
  }

  const hits = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ name, text }) => ({ name, text }));

  if (hits.length > 0) return hits;

  // Fallback: no keyword overlap, but the student has notes — send the opening
  // excerpts of the most recent documents so the model can still ground itself.
  const fallback: { name: string; text: string }[] = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks.slice(0, 2)) {
      fallback.push({ name: doc.name, text: chunk });
      if (fallback.length >= topK) return fallback;
    }
  }
  return fallback;
}

