// The word list and the check: words.txt holds one word per line, and a
// text is not ok when it holds one of them as a whole word, whatever its case.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type WordList = ReadonlySet<string>;

export const WORDS_PATH = fileURLToPath(new URL('../words.txt', import.meta.url));

// A word is a run of letters and digits, in any script.
const WORD = /^[\p{L}\p{N}]+$/u;

const fold = (text: string): string => text.normalize('NFC').toLowerCase();

// Blank lines and lines starting with # are left out; any other line must be
// one word, so a typo in the list fails the start instead of matching nothing.
export function parseWords(text: string): Set<string> {
  const list = new Set<string>();
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    if (!WORD.test(line)) throw new Error(`words.txt, line ${index + 1}: not one word of letters or digits: "${line}"`);
    list.add(fold(line));
  });
  return list;
}

export async function loadWords(path: string = WORDS_PATH): Promise<WordList> {
  return parseWords(await readFile(path, 'utf8'));
}

// The listed words the text holds, each once, in the order they first appear.
export function findWords(list: WordList, text: string): string[] {
  return [...findPositions(list, text).keys()];
}

// A run of letters, marks and digits is folded whole, so a decomposed accent
// composes with its letter; the words are then the runs of letters and digits
// of the folded run, a mark left alone splitting them.
const RUN = /[\p{L}\p{M}\p{N}]+/gu;
const PIECE = /[\p{L}\p{N}]+/gu;

const codePoints = (text: string): number => [...text].length;

// Where, in code points of the run as sent, starts the word found at offset
// `at` of the folded run: the shortest start of the run that folds to at
// least `at` units, found by halving.
function startInRun(run: string, at: number): number {
  if (at === 0) return 0;
  const points = [...run];
  let low = 1;
  let high = points.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (fold(points.slice(0, middle).join('')).length >= at) high = middle;
    else low = middle + 1;
  }
  return low;
}

// The listed words the text holds, in the order they first appear, each with
// the offsets where it starts, counted in code points of the text as sent.
export function findPositions(list: WordList, text: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  let index = 0;
  let offset = 0;
  for (const run of text.matchAll(RUN)) {
    offset += codePoints(text.slice(index, run.index));
    index = run.index;
    for (const piece of fold(run[0]).matchAll(PIECE)) {
      if (!list.has(piece[0])) continue;
      const at = offset + startInRun(run[0], piece.index);
      const positions = found.get(piece[0]);
      if (positions === undefined) found.set(piece[0], [at]);
      else positions.push(at);
    }
  }
  return found;
}
