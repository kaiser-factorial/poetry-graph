// Phonetic grouping helpers for the poem workspace.
// Spelling-based heuristics: good enough for grouping, with Datamuse
// providing the real rhyme lists on top.

const VOWELS = 'aeiouy';

function normalize(word) {
  return String(word).toLowerCase().replace(/[^a-z]/g, '');
}

// Rhyme family key: substring from the last vowel cluster to the end.
// "lost" -> "ost", "name" -> "ame" (silent-e aware), "day" -> "ay", "sky" -> "y"
function getRhymeEnding(word) {
  const w = normalize(word);
  if (w.length <= 2) return w;

  let end = w.length - 1;
  // Silent final e ("name", "line"): anchor on the vowel before it
  if (w[end] === 'e' && !VOWELS.includes(w[end - 1])) {
    end = end - 1;
  }

  let i = end;
  while (i >= 0 && !VOWELS.includes(w[i])) i--;
  if (i < 0) return w; // no vowels at all
  while (i > 0 && VOWELS.includes(w[i - 1])) i--;

  return w.slice(i);
}

// Onset key: the starting letter/sound. "cost" and "came" both -> "c".
// Digraphs keep their sound identity; common silent-letter starts resolve
// to the sounded letter (knight -> n).
const SILENT_STARTS = { kn: 'n', gn: 'n', wr: 'r', ps: 's', pn: 'n', mn: 'n' };
const DIGRAPHS = ['ch', 'sh', 'th', 'ph', 'wh'];

function getOnset(word) {
  const w = normalize(word);
  if (!w) return '';
  const two = w.slice(0, 2);
  if (SILENT_STARTS[two]) return SILENT_STARTS[two];
  if (DIGRAPHS.includes(two)) return two;
  return w[0];
}

module.exports = { normalize, getRhymeEnding, getOnset };
