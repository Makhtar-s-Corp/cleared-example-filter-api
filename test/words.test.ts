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

test('findPositions gives where each occurrence of each listed word starts, words in the order of the text', () => {
  const list = parseWords('spam\nscam\n');
  assert.deepEqual([...findPositions(list, 'A SCAM, some spam, more spam and a scam.')], [
    ['scam', [2, 35]],
    ['spam', [13, 24]],
  ]);
  assert.deepEqual([...findPositions(list, 'spammer antispam spam-free')], [['spam', [17]]]);
  assert.deepEqual([...findPositions(list, 'Lovely guestbook, thank you!')], []);
  assert.deepEqual([...findPositions(list, '')], []);
});

test('a mark that composes into nothing ends the word, so it cannot hide a listed word', () => {
  const list = parseWords('spam\n');
  const circle = String.fromCodePoint(0x20dd);
  const visarga = String.fromCodePoint(0x0903);
  assert.deepEqual(findWords(list, `spam${circle}`), ['spam']);
  assert.deepEqual(findWords(list, `spam${visarga} spam`), ['spam']);
  assert.deepEqual([...findPositions(list, `spam${circle}${visarga}spam spam`)], [['spam', [0, 6, 11]]]);
  assert.deepEqual(findWords(list, `${circle}spam`), ['spam'], 'a mark with no letter before it is not a word');
});

test('positions count code points of the text as sent, and an accent typed as a mark stays in its word', () => {
  const list = parseWords('spam\nété\n');
  assert.deepEqual([...findPositions(list, '😀 spam')], [['spam', [2]]], 'an emoji is one code point, two UTF-16 units');
  assert.deepEqual([...findPositions(list, 'Un bel été, spam'.normalize('NFD'))], [
    ['été', [7]],
    ['spam', [14]],
  ]);
});

test('a listed word of digits keeps its place in the order of the text', () => {
  const list = parseWords('spam\n2024\n');
  assert.deepEqual(findWords(list, 'spam in 2024'), ['spam', '2024']);
});

test('words.txt, the list the app serves, loads and is not empty', async () => {
  const list = await loadWords();
  assert.ok(list.size > 0);
  assert.deepEqual([...list], [...parseWords(readFileSync(WORDS_PATH, 'utf8'))]);
  assert.ok(list.has('spam'), 'the proof and the README use "spam" as the listed word');
});
