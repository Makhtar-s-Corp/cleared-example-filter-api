import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findPositions, findWords, loadWords, parseWords, WORDS_PATH } from '../src/words.ts';

test('the list is one word per line; blank lines and # comments are left out; case is folded', () => {
  const list = parseWords('# a comment\nSpam\n\n  scam  \nspam\n');
  assert.deepEqual([...list], ['spam', 'scam']);
});

test('a line that is not one word of letters or digits is refused, with its line number', () => {
  assert.throws(() => parseWords('spam\ntwo words\n'), /line 2/);
  assert.throws(() => parseWords('spam\nwh@t\n'), /line 2/);
});

test('findWords gives the listed words found, each once, in the order of the text', () => {
  const list = parseWords('spam\nscam\ncasino\n');
  assert.deepEqual(findWords(list, 'A SCAM, some spam, more spam and a scam.'), ['scam', 'spam']);
  assert.deepEqual(findWords(list, 'Lovely guestbook, thank you!'), []);
  assert.deepEqual(findWords(list, ''), []);
});

test('only whole words match: a listed word inside another word is not found', () => {
  const list = parseWords('spam\n');
  assert.deepEqual(findWords(list, 'spammer antispam spam-free'), ['spam']);
  assert.deepEqual(findWords(list, 'spammer antispam'), []);
});

test('words in other scripts and with accents are words too', () => {
  const list = parseWords('arnaque\nescroquerie\n');
  assert.deepEqual(findWords(list, "C'est une ARNAQUE, une escroquerie."), ['arnaque', 'escroquerie']);
  assert.deepEqual(findWords(parseWords('été\n'), 'Un bel été.'), ['été']);
});

test('findPositions gives, for each word found, the offsets where it starts, in the order of the text', () => {
  const list = parseWords('spam\nscam\ncasino\n');
  assert.deepEqual(findPositions(list, 'A SCAM, some spam, more spam and a scam.'), new Map([['scam', [2, 35]], ['spam', [13, 24]]]));
  assert.deepEqual(findPositions(list, 'spammer antispam spam-free'), new Map([['spam', [17]]]));
  assert.deepEqual(findPositions(list, 'Lovely guestbook, thank you!'), new Map());
  assert.deepEqual(findPositions(list, ''), new Map());
});

// Characters written as code points, so the decomposed forms stay what they are.
const EMOJI = String.fromCodePoint(0x1f600);
const ACUTE = String.fromCodePoint(0x301);
const DIAERESIS = String.fromCodePoint(0x308);
const ETE = `${String.fromCodePoint(0xe9)}t${String.fromCodePoint(0xe9)}`;

test('offsets are counted in code points of the text as sent, a decomposed accent counting as sent', () => {
  assert.deepEqual(findPositions(parseWords('spam\n'), `${EMOJI} spam`), new Map([['spam', [2]]]));
  const decomposed = `e${ACUTE}te${ACUTE}`;
  assert.deepEqual(findPositions(parseWords(`${ETE}\n`), `Un ${decomposed}, un ${ETE}.`), new Map([[ETE, [3, 13]]]));
});

test('a combining mark that composes with nothing still splits words, and offsets count it', () => {
  const list = parseWords('spam\n');
  const text = `Ok m${DIAERESIS}spam spam${DIAERESIS}`;
  assert.deepEqual(findPositions(list, text), new Map([['spam', [5, 10]]]));
  assert.deepEqual(findWords(list, text), ['spam']);
});

test('words.txt, the list the app serves, loads and is not empty', async () => {
  const list = await loadWords();
  assert.ok(list.size > 0);
  assert.deepEqual([...list], [...parseWords(readFileSync(WORDS_PATH, 'utf8'))]);
  assert.ok(list.has('spam'), 'the proof and the README use "spam" as the listed word');
});
