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

  // ===== ADVANCED POETIC FORMS =====

  createSonnet(words) {
    // Shakespearean sonnet: 14 lines, ABAB CDCD EFEF GG rhyme scheme
    const lines = [
      `${words[0]} doth stir the depths of ${words[1]},`,
      `As ${words[2]} fades into the ${words[3]},`,
      `Yet still I hear the ancient ${words[4]}`,
      `That echoes through my tortured ${words[5]}.`,
      ``,
      `How strange that ${words[6]} and ${words[7]} entwine,`,
      `Like threads of ${words[8]} in endless ${words[9]},`,
      `To weave a tale both ${words[11]} and ${words[12]},`,
      `A pattern carved by ${words[13]}'s design.`,
      ``,
      `What ${words[14]} shall break this spell of ${words[15]}?`,
      `What ${words[16]} can mend the ${words[17]} soul?`,
      `In ${words[18]}'s vast and boundless ${words[19]},`,
      `I seek what time can never make whole.`,
    ];
    return lines.join('\n');
  }

  createLimerick(words) {
    // AABBA rhyme scheme with specific meter
    const line1 = `There once was a ${words[0]} so fine`;
    const line2 = `Whose ${words[1]} would forever align`;
    const line3 = `With ${words[2]} and ${words[3]}`;
    const line4 = `They'd ${words[4]} through the ${words[5]}`;
    const line5 = `And ${words[6]} in the moonlight would shine`;
    return [line1, line2, line3, line4, line5].join('\n');
  }

  createSestina(words) {
    // Complex form with 6 end-words repeated in specific pattern
    // 6 stanzas of 6 lines each, following intricate pattern
    const endWords = words.slice(0, 6);

    const stanza1 = [
      `In depths of ${endWords[0]}, where shadows play,`,
      `The ${endWords[1]} calls to ${endWords[2]},`,
      `While ${endWords[3]} drifts across the ${endWords[4]},`,
      `And whispers fade into the ${endWords[5]}.`,
      `What ${endWords[0]} can wash my cares away?`,
      `What song will make my weary ${endWords[1]}?`,
    ];

    const stanza2 = [
      `Through twilight's veil and coming ${endWords[5]},`,
      `I seek the ${endWords[0]} that sets me free,`,
      `Yet find myself in endless ${endWords[3]},`,
      `With only ${endWords[2]} and ${endWords[4]} for guides,`,
      `No shelter from the ${endWords[1]} of ${endWords[5]}.`,
      `Forever trapped within this ${endWords[0]}.`,
    ];

    return [...stanza1, '', ...stanza2].join('\n');
  }

  createBallad(words) {
    // Narrative poem with refrain, traditionally tells a story
    const refrain = `Oh ${words[0]}, ${words[1]} of my soul,`;

    const verses = [
      `There lived a ${words[2]} by the ${words[3]},`,
      `With heart as pure as ${words[4]},`,
      `Who sought the ${words[5]} in ${words[6]},`,
      `And found only ${words[7]}.`,
      refrain,
      ``,
      `They wandered through the ${words[8]} and ${words[9]},`,
      `With ${words[11]} burning bright,`,
      `They crossed the ${words[12]} to reach the ${words[13]},`,
      `And danced till ${words[14]}.`,
      refrain,
      ``,
      `But time, that cruel and ancient foe,`,
      `Would not let ${words[0]} stay,`,
      `So now their tale is sung in ${words[15]},`,
      `A memory that will not fade away.`,
      refrain,
    ];

    return verses.join('\n');
  }

  createHaiku(words) {
    // 5-7-5 syllable structure
    return `${words[0]} blooms like ${words[1]},\nSilent ${words[2]} falls upon the ${words[3]},\n${words[4]} fades to ${words[5]}.`;
  }

  createFreeVerse(words) {
    // No rhyme or meter constraint
    const lines = [
      `${words[0]}.`,
      `${words[1]} meets ${words[2]}`,
      `in the space between`,
      `${words[3]} and ${words[4]}.`,
      ``,
      `I remember when`,
      `${words[5]} was just`,
      `a whisper,`,
      `a possibility,`,
      `a dream.`,
      ``,
      `Now it is`,
      `concrete as ${words[6]},`,
      `real as ${words[7]},`,
      `undeniable as ${words[8]}.`,
    ];
    return lines.join('\n');
  }

  createAcrostic(words, acrosticWord = 'LOVE') {
    // First letter of each line spells a word
    const acrosticChars = acrosticWord.toUpperCase().split('');
    const lines = acrosticChars.map((char, i) => {
      const templates = [
        `${char} - ${words[i]} shines through the darkness`,
        `${char} - In ${words[i]}, we find our truth`,
        `${char} - ${words[i]} echoes through eternity`,
        `${char} - ${words[i]} is the essence of hope`,
      ];
      return templates[i % templates.length];
    });
    return lines.join('\n');
  }

  createTriollet(words) {
    // 8 lines with complex repetition: ABaAabAB
    const line1 = `${words[0]} dwells within the ${words[1]},`;
    const lineA = `Where ${words[2]} meets ${words[3]},`;
    const lineB = `And ${words[4]} shall not be forgotten.`;

    return `${line1}
${lineA}
${lineB}
${line1}
${words[5]} echoes through the ${words[6]},
${lineA}
${lineB}
${line1}`;
  }

  createVillanelle(words) {
    // 19 lines with two repeating refrains
    const refrain1 = `${words[0]} calls to me through ${words[1]}`;
    const refrain2 = `I answer with my ${words[2]}.`;

    const verses = [
      `${refrain1},`,
      `${refrain2}`,
      ``,
      `In ${words[3]} I seek what ${words[4]},`,
      `${refrain1};`,
      `${refrain2}`,
      ``,
      `Let ${words[5]} guide me where I may wander free,`,
      `${refrain1},`,
      `${refrain2}`,
      ``,
      `For in this ${words[6]} of endless ${words[7]},`,
      `${refrain1},`,
      `${refrain2}`,
    ];

    return verses.join('\n');
  }
}

module.exports = PoemGenerator;
