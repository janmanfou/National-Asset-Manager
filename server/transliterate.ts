const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};

const NASALS: Record<string, string> = {
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
};

function transliterateWord(word: string): string {
  if (!word) return "";
  if (/^[a-zA-Z0-9.,'"\-\/]+$/.test(word)) return word;

  let out = '';
  let i = 0;

  while (i < word.length) {
    const ch = word[i];

    if (ch === '़') { i++; continue; }

    if (VOWELS[ch]) {
      out += VOWELS[ch];
      i++;
      continue;
    }

    if (NASALS[ch]) {
      out += NASALS[ch];
      i++;
      continue;
    }

    if (CONSONANTS[ch]) {
      out += CONSONANTS[ch];
      const next = word[i + 1];
      if (next === '्') {
        i += 2;
        continue;
      }
      if (next && MATRAS[next]) {
        out += MATRAS[next];
        i += 2;
        continue;
      }
      const isLast = (i === word.length - 1) ||
        (i === word.length - 2 && (word[i + 1] === 'ं' || word[i + 1] === 'ँ' || word[i + 1] === 'ः'));
      if (!isLast) {
        out += 'a';
      }
      i++;
      continue;
    }

    if (MATRAS[ch]) {
      out += MATRAS[ch];
      i++;
      continue;
    }

    if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch;
    }
    i++;
  }

  return out;
}

export function hindiToEnglish(text: string): string {
  if (!text || text.trim().length === 0) return "";
  if (/^[a-zA-Z\s.'\-\/0-9]+$/.test(text)) return text;

  return text
    .split(/\s+/)
    .map(w => {
      const t = transliterateWord(w);
      if (!t) return '';
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    })
    .filter(w => w.length > 0)
    .join(' ');
}
