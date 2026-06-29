// Poetry generation using the word graph structure

class PoemGenerator {
  constructor(graphData, embeddings, rhymeModule) {
    this.graph = graphData;
    this.embeddings = embeddings;
    this.rhyme = rhymeModule;
  }

  generateShortPoem(theme = '') {
    const words = this.graph.nodes.map(n => n.word);
    const structure = this.pickStructure();
    return this.buildPoem(words, structure);
  }

  generateLongerPoem(theme = '') {
    const words = this.graph.nodes.map(n => n.word);
    const structures = [
      this.createVerse,
      this.createCouplets,
      this.createStanza,
    ];

    const chosenStructure = structures[Math.floor(Math.random() * structures.length)];
    return chosenStructure.call(this, words);
  }

  pickStructure() {
    const structures = [
      {
        pattern: ['In [0], [1]', 'Where [2] and [3]', '[4] whispers [5]'],
        rhyme: true,
      },
      {
        pattern: ['[0] of [1]', '[2] through [3]', 'Forever [4] and [5]'],
        rhyme: false,
      },
      {
        pattern: [
          'The [0] [1],',
          'A [2] [3]—',
          'In [4], [5].',
        ],
        rhyme: false,
      },
    ];

    return structures[Math.floor(Math.random() * structures.length)];
  }

  buildPoem(words, structure) {
    const lines = [];
    let wordIndex = 0;

    for (const line of structure.pattern) {
      let processedLine = line;

      // Find all placeholders
      const placeholders = line.match(/\[\d+\]/g) || [];

      for (const placeholder of placeholders) {
        const idx = parseInt(placeholder.match(/\d+/)[0]);
        const wordSlot = (wordIndex + idx) % words.length;
        processedLine = processedLine.replace(placeholder, words[wordSlot]);
      }

      lines.push(processedLine);
      wordIndex += placeholders.length;
    }

    return lines.join('\n');
  }

  createVerse(words) {
    const verses = [
      [
        `In ${words[0]}'s embrace, ${words[1]} blooms,`,
        `Where ${words[2]} meets the silent ${words[3]}.`,
        `${words[4]} dances through forgotten ${words[5]},`,
        `A whisper of ${words[6]} in the ${words[7]}.`,
      ],
      [
        `${words[0]} falls like rain on ${words[1]},`,
        `The ${words[2]} of ${words[3]} unfolds.`,
        `In ${words[4]}, I find ${words[5]},`,
        `And ${words[6]} becomes my ${words[7]}.`,
      ],
      [
        `${words[0]} calls to ${words[1]},`,
        `Through nights of endless ${words[2]}.`,
        `The ${words[3]} we share, ${words[4]},`,
        `Echoes still in ${words[5]} and ${words[6]}.`,
      ],
    ];

    const chosen = verses[Math.floor(Math.random() * verses.length)];
    return chosen.join('\n');
  }

  createCouplets(words) {
    const couplets = [];

    for (let i = 0; i < Math.min(words.length - 1, 4); i++) {
      const word1 = words[i];
      const word2 = words[i + 1];

      const templates = [
        `${word1} in the darkness,\n${word2} shines bright.`,
        `The ${word1} of your ${word2},\nForever burns in my heart.`,
        `${word1} whispers softly,\n${word2} echoes back.`,
      ];

      couplets.push(templates[i % templates.length]);
    }

    return couplets.join('\n\n');
  }

  createStanza(words) {
    const stanzas = [
      `Where ${words[0]} meets ${words[1]},\nThe ${words[2]} takes flight.\n${words[3]} trembles in the dark,\nAs ${words[4]} ignites.`,
      `${words[0]}, ${words[1]}, ${words[2]}—\nThree words that hold the key.\n${words[3]} and ${words[4]} dance together,\nIn the garden of my dreams.`,
      `The ${words[0]} of ${words[1]},\nA journey through the night.\n${words[2]} calls to ${words[3]},\nIn the eternal ${words[4]}.`,
    ];

    return stanzas[Math.floor(Math.random() * stanzas.length)];
  }

  generateThematicPoem(theme, words) {
    // Simple thematic generation based on word relationships
    const themeWords = words.filter(w => w.includes(theme.toLowerCase()) || theme.includes(w));

    if (themeWords.length < 2) {
      return this.generateShortPoem(theme);
    }

    const lines = [
      `${themeWords[0]}, eternal ${theme},`,
      `Burns in every heart that seeks.`,
      `${themeWords[1]} guides us through the dark,`,
      `A beacon for the soul.`,
    ];

    return lines.join('\n');
  }
}

module.exports = PoemGenerator;
