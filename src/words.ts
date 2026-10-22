// The word list and the check: words.txt holds one word per line, and a
// text is not ok when it holds one of them as a whole word, whatever its case.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type WordList = ReadonlySet<string>;

export const WORDS_PATH = fileURLToPath(new URL('../words.txt', import.meta.url));

// A word is a run of letters and digits, in any script.
const WORD = /^[\p{L}\p{N}]+$/u;
const SEPARATORS = /[^\p{L}\p{N}]+/u;

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

// A run of letters, digits and the marks that may compose with them, and in
// it a letter or digit with the marks after it, or marks with no letter.
const RUN = /[\p{L}\p{N}\p{M}]+/gu;
const CLUSTER = /[\p{L}\p{N}]\p{M}*|\p{M}+/gu;
const MARK = /\p{M}/u;
const LEADING_MARK = /^\p{M}/u;

// Each word of the text, folded, with the offset where it starts in the text
// as sent. A mark that folding leaves on its own separates words, as it does
// in fold(text).split(SEPARATORS), so a word ends with the first cluster that
// keeps a mark once folded.
function* wordsAt(text: string): Generator<[string, number]> {
  for (const run of text.matchAll(RUN)) {
    let from: number | undefined;
    for (const cluster of run[0].matchAll(CLUSTER)) {
      if (from === undefined && !LEADING_MARK.test(cluster[0])) from = cluster.index;
      const end = cluster.index + cluster[0].length;
      if (from !== undefined && (MARK.test(fold(cluster[0])) || end === run[0].length)) {
        yield [fold(run[0].slice(from, end)).split(SEPARATORS)[0]!, run.index + from];
        from = undefined;
      }
    }
  }
}

// The listed words the text holds, in the order they first appear, each with
// every offset where it starts, in UTF-16 code units of the text as sent.
export function findPositions(list: WordList, text: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const [word, at] of wordsAt(text)) {
    if (!list.has(word)) continue;
    const offsets = found.get(word);
    if (offsets === undefined) found.set(word, [at]);
    else offsets.push(at);
  }
  return found;
}

// The listed words the text holds, each once, in the order they first appear.
export function findWords(list: WordList, text: string): string[] {
  return [...findPositions(list, text).keys()];
}
