const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { getEmbedding, cosineSimilarity, embeddings } = require('./embeddings');
const { rhymeScore, findRhymes } = require('./rhyme');
const { getRhymeEnding, getOnset, normalize } = require('./phonetics');
const ForceDirectedGraph = require('./forceLayout');
const PoemGenerator = require('./poemGenerator');

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

app.post('/api/poem', (req, res) => {
  const { words, theme, style } = req.body;
  let wordList = words || commonWords;

  const graph = buildPoetryGraph(wordList);
  const generator = new PoemGenerator(graph);

  let poem;
  const poemWords = graph.nodes.map(n => n.word);

  switch (style) {
    case 'sonnet':
      poem = generator.createSonnet(poemWords);
      break;
    case 'limerick':
      poem = generator.createLimerick(poemWords);
      break;
    case 'sestina':
      poem = generator.createSestina(poemWords);
      break;
    case 'ballad':
      poem = generator.createBallad(poemWords);
      break;
    case 'haiku':
      poem = generator.createHaiku(poemWords);
      break;
    case 'free-verse':
      poem = generator.createFreeVerse(poemWords);
      break;
    case 'acrostic':
      poem = generator.createAcrostic(poemWords);
      break;
    case 'triolet':
      poem = generator.createTriollet(poemWords);
      break;
    case 'villanelle':
      poem = generator.createVillanelle(poemWords);
      break;
    case 'long':
      poem = generator.generateLongerPoem(theme);
      break;
    case 'couplets':
      poem = generator.createCouplets(poemWords);
      break;
    case 'stanza':
      poem = generator.createStanza(poemWords);
      break;
    default:
      poem = generator.generateShortPoem(theme);
  }

  res.json({ poem, words: poemWords, style });
});

app.get('/api/poem/:theme', (req, res) => {
  const { theme } = req.params;
  const graph = buildPoetryGraph(commonWords);
  const generator = new PoemGenerator(graph);
  const poem = generator.generateThematicPoem(theme, graph.nodes.map(n => n.word));

  res.json({ poem, theme });
});

app.get('/api/poem-types', (req, res) => {
  const types = {
    'short': { name: 'Short Verse', lines: 3, description: 'Brief poetic lines' },
    'verse': { name: 'Verse', lines: 4, description: 'Narrative poetry' },
    'couplets': { name: 'Couplets', lines: 8, description: 'Paired rhyming lines' },
    'stanza': { name: 'Stanza', lines: 4, description: 'Verse structure' },
    'long': { name: 'Long Form', lines: 10, description: 'Extended narrative' },
    'haiku': { name: 'Haiku', lines: 3, description: '5-7-5 syllable form' },
    'limerick': { name: 'Limerick', lines: 5, description: 'AABBA rhyme scheme' },
    'sonnet': { name: 'Sonnet', lines: 14, description: 'Shakespearean sonnet' },
    'sestina': { name: 'Sestina', lines: 12, description: 'Complex 6-word pattern' },
    'ballad': { name: 'Ballad', lines: 20, description: 'Narrative with refrain' },
    'free-verse': { name: 'Free Verse', lines: 15, description: 'No rhyme or meter' },
    'acrostic': { name: 'Acrostic', lines: 4, description: 'First letters spell word' },
    'triolet': { name: 'Triolet', lines: 8, description: 'Complex repetition form' },
    'villanelle': { name: 'Villanelle', lines: 19, description: 'Two repeating refrains' },
  };
  res.json(types);
});

app.post('/api/configure-relationships', (req, res) => {
  const { word1, word2, similarity } = req.body;
  if (!word1 || !word2 || similarity === undefined) {
    return res.status(400).json({ error: 'word1, word2, and similarity required' });
  }

  const { getEmbedding } = require('./embeddings');
  const emb1 = getEmbedding(word1);
  const emb2 = getEmbedding(word2);

  // In a real system, this would update the embeddings database
  res.json({
    word1,
    word2,
    configuredSimilarity: similarity,
    currentEmbeddings: { [word1]: emb1, [word2]: emb2 },
    message: 'Relationship configured (demo only - embeddings not persisted)',
  });
});

app.get('/api/explore/:startWord', (req, res) => {
  const { startWord } = req.params;
  const depth = parseInt(req.query.depth) || 1;

  const explored = {
    word: startWord,
    rhymes: findRhymes(startWord, commonWords, 0.3),
    similar: [],
  };

  const embedding = getEmbedding(startWord);
  explored.similar = commonWords
    .filter(w => w !== startWord.toLowerCase())
    .map(w => ({
      word: w,
      similarity: cosineSimilarity(embedding, getEmbedding(w)),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  res.json(explored);
});

// ===== Poem Workspace endpoints =====

const DATAMUSE = 'https://api.datamuse.com/words';
const rhymeCache = new Map();
const alliterationCache = new Map();
const CLEAN_WORD = /^[a-z]+$/;

// Local fallback vocabulary: everything we know about
const localVocabulary = [...new Set([...commonWords, ...Object.keys(embeddings)])];

// Datamuse md=f tags look like "f:1.234567" — occurrences per million words
function wordFrequency(entry) {
  const tag = (entry.tags || []).find(t => t.startsWith('f:'));
  return tag ? parseFloat(tag.slice(2)) : 0;
}

async function fetchRhymes(word) {
  if (rhymeCache.has(word)) return rhymeCache.get(word);
  try {
    const { data } = await axios.get(DATAMUSE, {
      params: { rel_rhy: word, max: 80, md: 'f' },
      timeout: 4000,
    });
    // Keep Datamuse's rhyme-quality ordering, drop obscure words
    const rhymes = data
      .filter(entry => CLEAN_WORD.test(entry.word) && wordFrequency(entry) >= 0.4)
      .map(entry => entry.word)
      .slice(0, 40);
    rhymeCache.set(word, rhymes);
    return rhymes;
  } catch (err) {
    // Offline fallback: same spelling-derived ending within local vocabulary
    const ending = getRhymeEnding(word);
    const rhymes = localVocabulary.filter(
      w => w !== normalize(word) && getRhymeEnding(w) === ending
    );
    return rhymes;
  }
}

async function fetchAlliterations(onset) {
  if (alliterationCache.has(onset)) return alliterationCache.get(onset);

  // Poetry-friendly local words first, then common words from Datamuse
  const local = localVocabulary.filter(w => getOnset(w) === onset);
  let remote = [];
  try {
    const { data } = await axios.get(DATAMUSE, {
      params: { sp: `${onset}*`, max: 100, md: 'f' },
      timeout: 4000,
    });
    remote = data
      .filter(entry =>
        CLEAN_WORD.test(entry.word) &&
        entry.word.length >= 3 && entry.word.length <= 9 &&
        getOnset(entry.word) === onset &&
        wordFrequency(entry) >= 1)
      .sort((a, b) => wordFrequency(b) - wordFrequency(a))
      .map(entry => entry.word);
  } catch (err) { /* local only */ }

  const words = [...new Set([...local, ...remote])].slice(0, 30);
  alliterationCache.set(onset, words);
  return words;
}

// Full info for a word as the user adds it to the workspace
app.get('/api/word-info', async (req, res) => {
  const raw = req.query.word;
  if (!raw || !normalize(raw)) {
    return res.status(400).json({ error: 'word parameter required' });
  }
  const word = normalize(raw);
  const ending = getRhymeEnding(word);
  const onset = getOnset(word);
  const rhymes = await fetchRhymes(word);

  res.json({ word, ending, onset, rhymes });
});

// Suggestions for an alliteration group
app.get('/api/alliterations', async (req, res) => {
  const onset = normalize(req.query.onset || '');
  if (!onset) {
    return res.status(400).json({ error: 'onset parameter required' });
  }
  const words = await fetchAlliterations(onset);
  res.json({ onset, words });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Poetry Graph API running on http://localhost:${PORT}`);
});
