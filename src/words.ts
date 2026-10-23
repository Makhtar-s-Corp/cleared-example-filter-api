// The word list and the check: words.txt holds one word per line, and a
// text is not ok when it holds one of them as a whole word, whatever its case.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type WordList = ReadonlySet<string>;

export const WORDS_PATH = fileURLToPath(new URL('../words.txt', import.meta.url));

// A word is a run of letters and digits, in any script, once the text is in
// NFC: an accent typed as a separate mark (e then U+0301) composes into its
// letter, and a mark that composes into nothing (U+20DD) ends the word.
const WORD = /^[\p{L}\p{N}]+$/u;
const WORD_CHAR = /^[\p{L}\p{N}]$/u;
// A character with the marks that follow it: NFC composes within these, so
// each is normalized alone and keeps its offset in the text as sent.
const CLUSTERS = /\P{M}\p{M}*|\p{M}+/gu;

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
  let word = '';
  let start = 0;
  let offset = 0;
  const end = (): void => {
    const folded = fold(word);
    word = '';
    if (!list.has(folded)) return;
    const offsets = found.get(folded);
    if (offsets === undefined) found.set(folded, [start]);
    else offsets.push(start);
  };
  for (const [cluster] of text.matchAll(CLUSTERS)) {
    for (const char of cluster.normalize('NFC')) {
      if (!WORD_CHAR.test(char)) end();
      else if (word === '') {
        start = offset;
        word = char;
      } else word += char;
    }
    for (const _ of cluster) offset++;
  }
  end();
  return found;
}

// The listed words the text holds, each once, in the order they first appear.
export function findWords(list: WordList, text: string): string[] {
  return [...findPositions(list, text).keys()];
}
