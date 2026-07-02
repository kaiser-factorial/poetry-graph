# 🌙 Poetry Graph

An interactive force-directed graph that maps semantic and phonetic relationships between words, enabling exploration and generation of poetry through visual word clustering.

## Overview

Poetry Graph combines three key concepts:

1. **Semantic Embeddings**: Words with similar meanings cluster together
2. **Phonetic Compatibility**: Words that rhyme create attractive forces
3. **Force-Directed Layout**: Physics simulation creates an intuitive, explorable space

The result is an interactive visualization where clicking on any word reveals its rhyming partners and semantically similar words, inspiring creative combinations and new perspectives on word relationships.

## ✨ Poem Workspace (3D)

The centerpiece: [workspace.html](public/workspace.html) is a WebGL force-directed space for drafting a poem's sound-palette.

- Start from a lone **+** sphere; each word you add joins its **rhyme family** hub (`-ost`, `-ame`, …) or starts a new one
- Click a hub to expand it: members plus real rhyme suggestions (Datamuse, frequency-filtered) you can add with one click
- Toggle to **alliteration** and the same words physically reorganize under starting-sound hubs (`C-`, `WH-`, …)
- Four connection layers — rhyme, alliteration, part of speech, syllable count — each with a **force slider** controlling how strongly it pulls words together
- Orbit, zoom, and drag glossy spheres in a starfield with depth fog; poems persist locally and are shareable via `?seed=lost,name,cost`

## Features

- 🎨 **Interactive Force-Directed Graph**: Drag, pan, and zoom to explore word relationships
- 🎵 **Rhyme Finder**: Click any word to discover its rhyming companions
- 📚 **Semantic Search**: Find words with similar meanings and connotations
- ✍️ **Poem Generation**: Generate poetry in multiple styles using graph relationships:
  - Short verses
  - Rhyming couplets
  - Multi-line stanzas
  - Full narrative poems
- 🔍 **Custom Word Lists**: Add your own words to build personalized poetry spaces
- 🌈 **Visual Clustering**: See how concepts naturally group together

## Getting Started

### Prerequisites

- Node.js 14+
- npm

### Installation

```bash
# Install dependencies
npm install
cd backend && npm install

# The frontend uses D3 via CDN, no additional installation needed
```

### Running the Application

1. **Start the backend API** (Terminal 1):
```bash
cd backend
npm start
# API will run on http://localhost:3001
```

2. **Start the frontend server** (Terminal 2):
```bash
npx http-server public -p 3000
# Frontend will be available at http://localhost:3000
```

3. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

## API Endpoints

### Graph Operations

- `GET /api/graph` - Get default word graph
- `POST /api/graph` - Build graph from custom words
  ```json
  {
    "words": ["love", "heart", "fire", "passion"]
  }
  ```

### Word Relationships

- `GET /api/rhymes?word=love` - Find rhyming words
- `GET /api/similar?word=love` - Find semantically similar words
- `GET /api/words` - Get all available words

### Poetry Generation

- `POST /api/poem` - Generate poem
  ```json
  {
    "words": ["love", "heart", "fire"],
    "style": "verse" // or "couplets", "stanza", "long"
  }
  ```

- `GET /api/poem/:theme` - Generate poem with theme
  ```
  GET /api/poem/love
  ```

## Architecture

### Backend (`/backend`)

- **server.js**: Express API server
- **embeddings.js**: Word embedding system with semantic similarity
- **rhyme.js**: Phonetic matching and rhyme detection
- **forceLayout.js**: Force-directed graph layout engine
- **poemGenerator.js**: Poetry generation using word relationships

### Frontend (`/public`)

- **index.html**: UI layout and styling
- **app.js**: D3 visualization and interaction logic

## How It Works

### 1. Word Embeddings
Each word is represented as a 4-dimensional vector capturing semantic meaning:
```javascript
'love': [0.9, 0.8, 0.7, 0.6],
'heart': [0.85, 0.7, 0.65, 0.5],
// Similar vectors = similar meanings
```

### 2. Rhyme Detection
Words are matched by phonetic endings:
```javascript
'light', 'night', 'bright', 'might', 'sight' // All rhyme
'love', 'dove', 'above', 'thereof' // All rhyme
```

### 3. Force-Directed Layout
The graph positions words using forces:
- **Coulomb Repulsion**: All words push apart (-300 charge)
- **Spring Forces**: Related words (rhyming or similar) pull together
- **Damping**: Smooth motion with friction

### 4. Poetry Generation
The generator uses word relationships to create coherent verse:
```
In love's embrace, heart blooms,
Where beautiful meets the silent night.
Light dances through forgotten dreams,
A whisper of hope in the soul.
```

## Customization

### Add Custom Words

In the sidebar, type words separated by commas or spaces:
```
fire, passion, wine, divine
```

Press Enter to rebuild the graph with your words.

### Adjust Graph Parameters

Edit `/backend/server.js`:
```javascript
const graph = new ForceDirectedGraph(uniqueWords, {
  charge: -500,        // Repulsion strength
  linkDistance: 120,    // Spring rest length
  iterations: 100,      // Simulation steps
});
```

### Extend Embeddings

Add more words to `/backend/embeddings.js`:
```javascript
const embeddings = {
  'mystique': [0.7, 0.8, 0.9, 0.6],
  'whisper': [0.6, 0.5, 0.8, 0.7],
  // ... more words
};
```

## Example Poems

See [POEMS.md](POEMS.md) for poetry generated by the graph.

## Technical Stack

- **Frontend**: D3.js 7 for visualization
- **Backend**: Express.js for API
- **Layout**: Custom force-directed simulation
- **Embeddings**: Custom 4D vectors (can be extended to use pre-trained models)
- **Rhyming**: Phonetic pattern matching

## Future Enhancements

- [ ] Integration with word2vec or GloVe embeddings for better semantics
- [ ] Advanced phonetic matching (IPA-based rhyming)
- [ ] Persistent user-created word graphs
- [ ] Social sharing of generated poems
- [ ] Music integration (converting poems to melody)
- [ ] Multi-language support
- [ ] Real-time collaboration

## Contributing

Ideas and pull requests welcome! Some areas for contribution:

- Improved embedding models
- More sophisticated rhyme detection
- Better poem generation templates
- Frontend UI enhancements
- Performance optimization

## License

MIT

## Author

Created with creativity and mathematics as an exploration of how language can be visualized, played with, and transformed through computation.

---

**Try it out!** Open [http://localhost:3000](http://localhost:3000) and start exploring the space between meaning and sound. 🎨✨
