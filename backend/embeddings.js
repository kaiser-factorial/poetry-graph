// Simple word embedding system using pre-computed vector representations
// In production, this would use a proper embedding model

const embeddings = {
  // Common words with simple vector representations (simplified for demo)
  // These are hand-crafted to show semantic relationships
  'love': [0.9, 0.8, 0.7, 0.6],
  'heart': [0.85, 0.7, 0.65, 0.5],
  'beautiful': [0.8, 0.9, 0.7, 0.4],
  'night': [0.2, 0.1, 0.8, 0.9],
  'light': [0.9, 0.85, 0.7, 0.2],
  'star': [0.8, 0.9, 0.75, 0.3],
  'moon': [0.7, 0.8, 0.85, 0.6],
  'dream': [0.6, 0.7, 0.8, 0.9],
  'hope': [0.7, 0.8, 0.6, 0.5],
  'soul': [0.8, 0.7, 0.6, 0.8],
  'fire': [0.9, 0.5, 0.2, 0.1],
  'passion': [0.9, 0.7, 0.4, 0.3],
  'wine': [0.8, 0.6, 0.3, 0.2],
  'divine': [0.7, 0.8, 0.9, 0.6],
  'time': [0.3, 0.4, 0.5, 0.6],
  'rose': [0.8, 0.6, 0.7, 0.4],
  'thorn': [0.7, 0.3, 0.2, 0.5],
  'pain': [0.3, 0.2, 0.7, 0.8],
  'rain': [0.3, 0.2, 0.7, 0.9],
  'shine': [0.9, 0.85, 0.6, 0.1],
  'mine': [0.8, 0.7, 0.5, 0.6],
  'wine': [0.8, 0.6, 0.3, 0.2],
  'line': [0.5, 0.5, 0.5, 0.5],
  'cloud': [0.3, 0.3, 0.8, 0.7],
  'ground': [0.2, 0.1, 0.3, 0.4],
  'sound': [0.4, 0.3, 0.6, 0.7],
  'bound': [0.5, 0.4, 0.5, 0.5],
  'found': [0.5, 0.4, 0.5, 0.5],
  'sea': [0.2, 0.3, 0.8, 0.7],
  'free': [0.7, 0.8, 0.5, 0.3],
  'tree': [0.5, 0.6, 0.7, 0.3],
  'me': [0.6, 0.5, 0.4, 0.3],
  'key': [0.5, 0.5, 0.5, 0.5],
  'be': [0.6, 0.5, 0.4, 0.3],
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
