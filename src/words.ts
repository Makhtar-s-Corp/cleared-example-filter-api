// The word list and the check: words.txt holds one word per line, and a
// text is not ok when it holds one of them as a whole word, whatever its case.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type WordList = ReadonlySet<string>;

export const WORDS_PATH = fileURLToPath(new URL('../words.txt', import.meta.url));

// A word is a run of letters and digits, in any script. In a text, a word may
// also carry combining marks after its first character, so an accent typed
// as a separate mark (e then U+0301) stays inside its word.
const WORD = /^[\p{L}\p{N}]+$/u;
const WORDS_IN_TEXT = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu;

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

// Where the listed words the text holds start: for each word, folded, the
// offsets of all its occurrences, in code points of the text as sent. The
// words come in the order they first appear (a Map, since an object would put
// a word of digits first).
export function findPositions(list: WordList, text: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  let index = 0;
  let offset = 0;
  for (const match of text.matchAll(WORDS_IN_TEXT)) {
    for (const _ of text.slice(index, match.index)) offset++;
    index = match.index;
    const word = fold(match[0]);
    if (!list.has(word)) continue;
    const offsets = found.get(word);
    if (offsets === undefined) found.set(word, [offset]);
    else offsets.push(offset);
  }
  return found;
}

// The listed words the text holds, each once, in the order they first appear.
export function findWords(list: WordList, text: string): string[] {
  return [...findPositions(list, text).keys()];
}
