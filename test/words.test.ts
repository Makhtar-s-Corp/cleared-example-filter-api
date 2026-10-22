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

// Built from code points, so the source shows which form each text is in.
const ACUTE = String.fromCodePoint(0x301);
const E_ACUTE = String.fromCodePoint(0xe9);
const CAPITAL_I_DOT = String.fromCodePoint(0x130);
const EMOJI = String.fromCodePoint(0x1f600);
const SIGMA = String.fromCodePoint(0x3a3);
const PI = String.fromCodePoint(0x3a0);
const ALPHA = String.fromCodePoint(0x391);
const MU = String.fromCodePoint(0x39c);

test('findPositions gives each word found with every offset where it starts, in the order of the text', () => {
  const list = parseWords('spam\nscam\n');
  assert.deepEqual(findPositions(list, 'A SCAM, some spam, more Spam and a scam.'), new Map([['scam', [2, 35]], ['spam', [13, 24]]]));
  assert.deepEqual(findPositions(list, 'spammer antispam spam-free'), new Map([['spam', [17]]]));
  assert.deepEqual(findPositions(list, 'Lovely guestbook, thank you!'), new Map());
});

test('offsets count UTF-16 code units of the text as sent, before folding', () => {
  const list = parseWords(`spam\n${E_ACUTE}t${E_ACUTE}\n`);
  assert.deepEqual(findPositions(list, `${EMOJI} spam`), new Map([['spam', [3]]]), 'an emoji is two code units');
  assert.deepEqual(
    findPositions(list, `Un bel e${ACUTE}te${ACUTE}, spam`),
    new Map([[`${E_ACUTE}t${E_ACUTE}`, [7]], ['spam', [14]]]),
    'decomposed accents',
  );
  assert.deepEqual(findPositions(list, `${CAPITAL_I_DOT}${CAPITAL_I_DOT} spam`), new Map([['spam', [3]]]), 'a capital whose lower case is longer');
});

test('a mark folding leaves on its own separates words, as it does for findWords', () => {
  const list = parseWords('spam\nham\n');
  assert.deepEqual(findPositions(list, `x${ACUTE}spam ${ACUTE}ham`), new Map([['spam', [2]], ['ham', [8]]]));
  assert.deepEqual(findPositions(list, `${CAPITAL_I_DOT}spam`), new Map([['spam', [1]]]));
  const text = `x${ACUTE}spam ${ACUTE}ham ${CAPITAL_I_DOT}spam e${ACUTE}te${ACUTE} ${SIGMA}${PI}${ALPHA}${MU}${SIGMA}`;
  const words = parseWords(`spam\nham\n${E_ACUTE}t${E_ACUTE}\n${`${SIGMA}${PI}${ALPHA}${MU}${SIGMA}`.toLowerCase()}\n`);
  const split = new Set(text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u));
  assert.deepEqual(findWords(words, text), [...words].filter((word) => split.has(word)));
  assert.equal(findWords(words, text).length, 4);
});

test('words.txt, the list the app serves, loads and is not empty', async () => {
  const list = await loadWords();
  assert.ok(list.size > 0);
  assert.deepEqual([...list], [...parseWords(readFileSync(WORDS_PATH, 'utf8'))]);
  assert.ok(list.has('spam'), 'the proof and the README use "spam" as the listed word');
});
