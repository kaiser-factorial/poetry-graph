const express = require('express');
const cors = require('cors');
const path = require('path');
const { getEmbedding, cosineSimilarity } = require('./embeddings');
const { rhymeScore, findRhymes } = require('./rhyme');
const ForceDirectedGraph = require('./forceLayout');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Common poetry words
const commonWords = [
  'love', 'heart', 'beautiful', 'night', 'light', 'star', 'moon', 'dream', 'hope', 'soul',
  'fire', 'passion', 'wine', 'divine', 'time', 'rose', 'thorn', 'pain', 'rain', 'shine',
  'mine', 'line', 'cloud', 'ground', 'sound', 'bound', 'found', 'sea', 'free', 'tree',
  'me', 'key', 'be', 'sky', 'fly', 'die', 'try', 'cry', 'sigh', 'high', 'goodbye',
];

app.get('/api/graph', (req, res) => {
  const words = req.query.words ? req.query.words.split(',') : commonWords;
  const graph = buildPoetryGraph(words);
  res.json(graph);
});

app.post('/api/graph', (req, res) => {
  const { words } = req.body;
  if (!words || !Array.isArray(words)) {
    return res.status(400).json({ error: 'words must be an array' });
  }
  const graph = buildPoetryGraph(words);
  res.json(graph);
});

function buildPoetryGraph(words) {
  const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))].slice(0, 30);

  const graph = new ForceDirectedGraph(uniqueWords, {
    width: 800,
    height: 600,
    charge: -500,
    linkDistance: 120,
    iterations: 100,
  });

  // Add links based on semantic similarity and rhyming
  for (let i = 0; i < uniqueWords.length; i++) {
    for (let j = i + 1; j < uniqueWords.length; j++) {
      const word1 = uniqueWords[i];
      const word2 = uniqueWords[j];

      // Semantic similarity
      const emb1 = getEmbedding(word1);
      const emb2 = getEmbedding(word2);
      const semanticSim = cosineSimilarity(emb1, emb2);

      // Rhyme score
      const rhyme = rhymeScore(word1, word2);

      // Combined strength: prefer rhymes, but also use semantic similarity
      const strength = Math.max(rhyme * 2, semanticSim * 0.5);

      if (strength > 0.1) {
        graph.addLink(word1, word2, strength);
      }
    }
  }

  return graph.simulate();
}

app.get('/api/rhymes', (req, res) => {
  const { word } = req.query;
  if (!word) {
    return res.status(400).json({ error: 'word parameter required' });
  }

  const rhymes = findRhymes(word, commonWords, 0.3);
  res.json({ word, rhymes });
});

app.get('/api/similar', (req, res) => {
  const { word } = req.query;
  if (!word) {
    return res.status(400).json({ error: 'word parameter required' });
  }

  const embedding = getEmbedding(word);
  const similar = commonWords
    .filter(w => w !== word.toLowerCase())
    .map(w => ({
      word: w,
      similarity: cosineSimilarity(embedding, getEmbedding(w)),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  res.json({ word, similar });
});

app.get('/api/words', (req, res) => {
  res.json({ words: commonWords });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Poetry Graph API running on http://localhost:${PORT}`);
});
