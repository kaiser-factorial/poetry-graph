// Simple rhyme detection based on phonetic patterns

const rhymePatterns = {
  // -ove rhymes
  'ove': ['love', 'dove', 'above', 'glove', 'shove', 'thereof', 'thereof'],

  // -eart/-art rhymes
  'eart': ['heart', 'part', 'start', 'art', 'smart', 'depart'],
  'art': ['heart', 'part', 'start', 'art', 'smart', 'depart'],

  // -ight rhymes
  'ight': ['light', 'night', 'bright', 'might', 'sight', 'flight', 'right', 'tight', 'fright'],

  // -ar rhymes
  'ar': ['star', 'far', 'car', 'bar', 'jar', 'war', 'scar'],

  // -ream rhymes
  'ream': ['dream', 'stream', 'beam', 'scheme', 'seem'],

  // -ope rhymes
  'ope': ['hope', 'rope', 'slope', 'cope', 'dope'],

  // -oul/-ole rhymes
  'oul': ['soul', 'goal', 'roll', 'toll'],
  'ole': ['soul', 'goal', 'roll', 'toll'],

  // -ire rhymes
  'ire': ['fire', 'wire', 'desire', 'higher', 'entire', 'inspire', 'aspire'],

  // -ine rhymes
  'ine': ['divine', 'wine', 'mine', 'fine', 'shine', 'line', 'thine', 'define', 'refine'],

  // -ose rhymes
  'ose': ['rose', 'close', 'prose', 'those', 'nose', 'suppose', 'compose'],

  // -orn rhymes
  'orn': ['thorn', 'born', 'worn', 'morn', 'scorn', 'forlorn'],

  // -ain rhymes
  'ain': ['pain', 'rain', 'plain', 'gain', 'strain', 'vain', 'main', 'brain', 'train'],

  // -ound rhymes
  'ound': ['sound', 'found', 'ground', 'bound', 'round', 'wound', 'profound'],

  // -ea/-ee rhymes
  'ea': ['sea', 'free', 'tree', 'key', 'me', 'be', 'spree', 'three'],
  'ee': ['sea', 'free', 'tree', 'key', 'me', 'be', 'spree', 'three', 'glee', 'flee'],

  // -oud rhymes
  'oud': ['cloud', 'loud', 'proud', 'shroud'],

  // -old rhymes
  'old': ['old', 'gold', 'hold', 'cold', 'bold', 'told', 'sold', 'behold'],

  // -ay rhymes
  'ay': ['day', 'way', 'say', 'play', 'stay', 'gray', 'may', 'bay', 'slay', 'pray'],

  // -ing rhymes
  'ing': ['sing', 'ring', 'wing', 'bring', 'spring', 'string', 'thing', 'sting'],

  // -ace rhymes
  'ace': ['grace', 'place', 'face', 'embrace', 'trace'],

  // -ame rhymes
  'ame': ['flame', 'shame', 'blame', 'fame', 'game', 'same', 'tame'],

  // -aze rhymes
  'aze': ['blaze', 'gaze', 'daze', 'amaze', 'craze'],

  // -eam rhymes
  'eam': ['dream', 'stream', 'beam', 'team', 'gleam', 'scheme', 'seem'],

  // -eart rhymes
  'art': ['heart', 'part', 'start', 'art', 'smart', 'depart'],

  // -ow rhymes
  'ow': ['glow', 'flow', 'know', 'show', 'grow', 'slow', 'throw'],

  // -ight rhymes
  'ite': ['white', 'right', 'light', 'sight', 'might', 'flight', 'write'],

  // -oom rhymes
  'oom': ['bloom', 'room', 'gloom', 'doom', 'loom', 'assume', 'consume'],

  // -oon rhymes
  'oon': ['moon', 'soon', 'June', 'tune', 'croon', 'swoon'],

  // -all rhymes
  'all': ['call', 'fall', 'small', 'wall', 'ball', 'tall', 'sprawl'],

  // -ore rhymes
  'ore': ['more', 'shore', 'store', 'door', 'floor', 'core', 'explore'],

  // -eart rhymes
  'eart': ['heart', 'part', 'start', 'art', 'depart'],

  // -le rhymes
  'le': ['simple', 'gentle', 'tremble', 'candle', 'spindle'],

  // -th rhymes
  'th': ['death', 'breath', 'faith', 'path', 'wrath', 'bath'],
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
