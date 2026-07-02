// Simple word embedding system using pre-computed vector representations
// In production, this would use a proper embedding model

const embeddings = {
  // Love & Romance (8 words)
  'love': [0.9, 0.8, 0.7, 0.6],
  'heart': [0.85, 0.7, 0.65, 0.5],
  'beloved': [0.88, 0.75, 0.68, 0.55],
  'passion': [0.9, 0.7, 0.4, 0.3],
  'desire': [0.85, 0.65, 0.35, 0.25],
  'embrace': [0.8, 0.75, 0.6, 0.5],
  'tender': [0.75, 0.8, 0.65, 0.55],
  'ardent': [0.88, 0.72, 0.45, 0.35],

  // Beauty & Aesthetics (6 words)
  'beautiful': [0.8, 0.9, 0.7, 0.4],
  'lovely': [0.75, 0.85, 0.75, 0.45],
  'radiant': [0.85, 0.88, 0.6, 0.3],
  'sublime': [0.8, 0.85, 0.75, 0.5],
  'grace': [0.75, 0.8, 0.7, 0.6],
  'elegance': [0.78, 0.82, 0.72, 0.58],

  // Light & Darkness (11 words)
  'light': [0.9, 0.85, 0.7, 0.2],
  'night': [0.2, 0.1, 0.8, 0.9],
  'star': [0.8, 0.9, 0.75, 0.3],
  'moon': [0.7, 0.8, 0.85, 0.6],
  'shine': [0.9, 0.85, 0.6, 0.1],
  'glow': [0.85, 0.82, 0.65, 0.15],
  'shadow': [0.25, 0.2, 0.75, 0.85],
  'darkness': [0.15, 0.1, 0.85, 0.95],
  'dawn': [0.75, 0.8, 0.5, 0.3],
  'dusk': [0.6, 0.65, 0.7, 0.7],
  'twilight': [0.65, 0.7, 0.75, 0.65],

  // Nature (24 words)
  'sea': [0.2, 0.3, 0.8, 0.7],
  'ocean': [0.15, 0.25, 0.85, 0.75],
  'wave': [0.3, 0.35, 0.75, 0.7],
  'shore': [0.35, 0.4, 0.7, 0.65],
  'sand': [0.4, 0.35, 0.65, 0.6],
  'forest': [0.4, 0.45, 0.65, 0.6],
  'tree': [0.5, 0.6, 0.7, 0.3],
  'flower': [0.7, 0.75, 0.6, 0.4],
  'rose': [0.8, 0.6, 0.7, 0.4],
  'thorn': [0.7, 0.3, 0.2, 0.5],
  'petal': [0.75, 0.7, 0.65, 0.35],
  'bloom': [0.75, 0.8, 0.6, 0.35],
  'sky': [0.7, 0.75, 0.8, 0.3],
  'cloud': [0.3, 0.3, 0.8, 0.7],
  'rain': [0.3, 0.2, 0.7, 0.9],
  'wind': [0.35, 0.3, 0.75, 0.8],
  'storm': [0.2, 0.15, 0.8, 0.9],
  'thunder': [0.15, 0.1, 0.85, 0.95],
  'ground': [0.2, 0.1, 0.3, 0.4],

  // Emotions & Spirit (15 words)
  'hope': [0.7, 0.8, 0.6, 0.5],
  'sorrow': [0.3, 0.2, 0.8, 0.85],
  'joy': [0.85, 0.9, 0.5, 0.2],
  'grief': [0.2, 0.1, 0.85, 0.9],
  'soul': [0.8, 0.7, 0.6, 0.8],
  'spirit': [0.75, 0.8, 0.65, 0.75],
  'mind': [0.7, 0.75, 0.55, 0.7],
  'pain': [0.3, 0.2, 0.7, 0.8],
  'ache': [0.35, 0.25, 0.75, 0.8],
  'longing': [0.6, 0.5, 0.7, 0.75],
  'yearning': [0.65, 0.55, 0.68, 0.72],
  'despair': [0.1, 0.05, 0.9, 0.95],
  'ecstasy': [0.9, 0.95, 0.4, 0.1],
  'bliss': [0.85, 0.9, 0.5, 0.2],
  'anguish': [0.15, 0.1, 0.9, 0.92],

  // Dreams & Fantasy (9 words)
  'dream': [0.6, 0.7, 0.8, 0.9],
  'vision': [0.65, 0.75, 0.75, 0.8],
  'fantasy': [0.7, 0.75, 0.8, 0.85],
  'illusion': [0.55, 0.6, 0.8, 0.85],
  'wonder': [0.75, 0.8, 0.7, 0.6],
  'magic': [0.8, 0.75, 0.75, 0.7],
  'mystic': [0.65, 0.7, 0.8, 0.75],
  'enchant': [0.75, 0.8, 0.65, 0.5],
  'spell': [0.7, 0.65, 0.7, 0.65],

  // Time & Eternity (7 words)
  'time': [0.3, 0.4, 0.5, 0.6],
  'eternity': [0.5, 0.6, 0.9, 0.85],
  'moment': [0.4, 0.45, 0.55, 0.5],
  'age': [0.35, 0.3, 0.6, 0.75],
  'forever': [0.55, 0.65, 0.85, 0.8],
  'eternal': [0.6, 0.7, 0.85, 0.8],
  'immortal': [0.65, 0.75, 0.8, 0.75],

  // Elements & Fire (8 words)
  'fire': [0.9, 0.5, 0.2, 0.1],
  'flame': [0.88, 0.55, 0.25, 0.15],
  'blaze': [0.92, 0.6, 0.2, 0.05],
  'heat': [0.85, 0.45, 0.3, 0.2],
  'burn': [0.88, 0.4, 0.25, 0.1],
  'smoke': [0.7, 0.35, 0.4, 0.3],
  'ash': [0.6, 0.3, 0.5, 0.4],
  'ember': [0.85, 0.4, 0.3, 0.2],

  // Wine & Indulgence (5 words)
  'wine': [0.8, 0.6, 0.3, 0.2],
  'divine': [0.7, 0.8, 0.9, 0.6],
  'nectar': [0.75, 0.7, 0.5, 0.3],
  'sweet': [0.7, 0.75, 0.5, 0.3],
  'intoxicate': [0.75, 0.65, 0.4, 0.2],

  // Poetry & Art (10 words)
  'verse': [0.7, 0.75, 0.6, 0.65],
  'rhyme': [0.75, 0.7, 0.65, 0.6],
  'song': [0.75, 0.8, 0.65, 0.55],
  'music': [0.8, 0.85, 0.6, 0.5],
  'melody': [0.8, 0.82, 0.65, 0.5],
  'harmony': [0.75, 0.8, 0.7, 0.65],
  'symphony': [0.78, 0.82, 0.72, 0.68],
  'lyre': [0.75, 0.7, 0.65, 0.55],
  'muse': [0.75, 0.8, 0.7, 0.65],
  'poet': [0.7, 0.75, 0.65, 0.7],

  // Sorrow & Loss (7 words)
  'weep': [0.2, 0.15, 0.85, 0.9],
  'tears': [0.25, 0.2, 0.8, 0.88],
  'lament': [0.2, 0.1, 0.85, 0.9],
  'mourn': [0.15, 0.1, 0.9, 0.95],
  'fade': [0.35, 0.3, 0.7, 0.75],
  'wither': [0.3, 0.25, 0.75, 0.8],
  'death': [0.1, 0.05, 0.95, 0.98],

  // Virtues (8 words)
  'truth': [0.75, 0.8, 0.6, 0.65],
  'wisdom': [0.8, 0.85, 0.65, 0.7],
  'virtue': [0.75, 0.8, 0.65, 0.7],
  'valor': [0.8, 0.7, 0.4, 0.3],
  'honor': [0.78, 0.75, 0.55, 0.5],
  'glory': [0.8, 0.85, 0.6, 0.4],
  'noble': [0.78, 0.8, 0.65, 0.55],
  'pure': [0.8, 0.85, 0.65, 0.5],

  // Sensations (9 words)
  'soft': [0.7, 0.8, 0.65, 0.55],
  'gentle': [0.72, 0.82, 0.68, 0.58],
  'harsh': [0.3, 0.2, 0.7, 0.8],
  'silent': [0.4, 0.45, 0.75, 0.8],
  'whisper': [0.6, 0.65, 0.7, 0.75],
  'echo': [0.55, 0.6, 0.7, 0.72],
  'sound': [0.4, 0.3, 0.6, 0.7],
  'voice': [0.65, 0.7, 0.6, 0.65],
  'silence': [0.35, 0.4, 0.8, 0.85],

  // Journey & Quest (7 words)
  'journey': [0.5, 0.55, 0.6, 0.65],
  'path': [0.45, 0.5, 0.65, 0.6],
  'road': [0.48, 0.52, 0.65, 0.62],
  'wander': [0.52, 0.58, 0.65, 0.68],
  'quest': [0.6, 0.65, 0.55, 0.6],
  'voyage': [0.52, 0.58, 0.62, 0.65],
  'adventure': [0.7, 0.75, 0.55, 0.5],

  // Rhyming words (10 words)
  'bound': [0.5, 0.4, 0.5, 0.5],
  'found': [0.5, 0.4, 0.5, 0.5],
  'line': [0.5, 0.5, 0.5, 0.5],
  'mine': [0.8, 0.7, 0.5, 0.6],
  'thine': [0.75, 0.65, 0.55, 0.65],
  'fine': [0.75, 0.8, 0.5, 0.4],
  'free': [0.7, 0.8, 0.5, 0.3],
  'key': [0.5, 0.5, 0.5, 0.5],
  'be': [0.6, 0.5, 0.4, 0.3],
  'see': [0.6, 0.65, 0.55, 0.5],
};

function getEmbedding(word) {
  const normalized = word.toLowerCase();
  if (embeddings[normalized]) {
    return embeddings[normalized];
  }
  // Generate a pseudo-random embedding based on word hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  const seed = Math.abs(hash);
  return [
    Math.sin(seed * 0.1) * 0.5 + 0.5,
    Math.sin(seed * 0.2) * 0.5 + 0.5,
    Math.sin(seed * 0.3) * 0.5 + 0.5,
    Math.sin(seed * 0.4) * 0.5 + 0.5,
  ];
}

function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) return 0;
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

module.exports = {
  getEmbedding,
  cosineSimilarity,
  embeddings,
};
