// Simple rhyme detection based on phonetic patterns

const rhymePatterns = {
  'ove': ['love', 'dove', 'above', 'glove', 'shove', 'thereof', 'thereof'],
  'eart': ['heart', 'part', 'start', 'art', 'smart', 'depart'],
  'ight': ['light', 'night', 'bright', 'might', 'sight', 'flight', 'right', 'tight', 'fright'],
  'ar': ['star', 'far', 'car', 'bar', 'jar', 'war', 'scar'],
  'ream': ['dream', 'stream', 'beam', 'scheme', 'seem'],
  'ope': ['hope', 'rope', 'slope', 'cope', 'dope'],
  'oul': ['soul', 'goal', 'roll', 'toll'],
  'ire': ['fire', 'wire', 'desire', 'higher', 'entire'],
  'ine': ['divine', 'wine', 'mine', 'fine', 'shine', 'line'],
  'ose': ['rose', 'close', 'prose', 'those', 'nose'],
  'orn': ['thorn', 'born', 'worn', 'morn', 'scorn'],
  'ain': ['pain', 'rain', 'plain', 'gain', 'strain', 'vain'],
  'ound': ['sound', 'found', 'ground', 'bound', 'round', 'wound'],
  'ea': ['sea', 'free', 'tree', 'key', 'me', 'be', 'spree'],
  'oud': ['cloud', 'loud', 'proud', 'shroud'],
  'old': ['old', 'gold', 'hold', 'cold', 'bold', 'told', 'sold'],
  'ay': ['day', 'way', 'say', 'play', 'stay', 'gray', 'may', 'bay'],
  'ing': ['sing', 'ring', 'wing', 'bring', 'spring', 'string', 'thing'],
};

function getPhoneticEnding(word) {
  const normalized = word.toLowerCase();

  // Check for common endings
  for (const [ending, words] of Object.entries(rhymePatterns)) {
    if (normalized.endsWith(ending)) {
      return ending;
    }
  }

  // Fallback: use last 2-3 characters
  if (normalized.length >= 3) {
    return normalized.slice(-3);
  }
  return normalized.slice(-2);
}

function rhymeScore(word1, word2) {
  if (word1.toLowerCase() === word2.toLowerCase()) return 0;

  const ending1 = getPhoneticEnding(word1);
  const ending2 = getPhoneticEnding(word2);

  // Exact match on ending
  if (ending1 === ending2) return 1.0;

  // Check if one ending contains the other
  if (ending1.includes(ending2) || ending2.includes(ending1)) {
    return 0.7;
  }

  // Check for last character match
  if (ending1.slice(-1) === ending2.slice(-1)) {
    return 0.3;
  }

  return 0;
}

function findRhymes(word, wordList, threshold = 0.5) {
  return wordList
    .filter(w => w.toLowerCase() !== word.toLowerCase())
    .map(w => ({
      word: w,
      score: rhymeScore(word, w),
    }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  rhymeScore,
  findRhymes,
  getPhoneticEnding,
  rhymePatterns,
};
