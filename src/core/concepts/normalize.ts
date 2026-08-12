export function normalizeConceptName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
}

export function cleanExtractedText(text: string): string {
  if (!text) return '';

  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Remove running textbook headers, footers, and standalone page numbers
  cleaned = cleaned
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^\d{1,4}$/.test(trimmed)) return false;
      if (/^\d{1,4}\s+[A-Z\s]{4,}$/.test(trimmed)) return false;
      if (/^[A-Z\s]{4,}\s+\d{1,4}$/.test(trimmed)) return false;
      if (/^(CHAPTER|PAGE)\s+\d+/i.test(trimmed)) return false;
      return true;
    })
    .join('\n');

  // 2. Repair line-break hyphenation ("fun-\ndamental" -> "fundamental")
  cleaned = cleaned.replace(/([a-zA-Z]{2,})-\s*\n\s*([a-zA-Z]{2,})/g, '$1$2');
  cleaned = cleaned.replace(/([a-zA-Z]{2,})-\s+([a-zA-Z]{2,})/g, (match, p1, p2) => {
    const l1 = p1.toLowerCase();
    if (l1 === 'non' || l1 === 'gram' || l1 === 'semi' || l1 === 'anti') return `${p1}-${p2}`;
    return `${p1}${p2}`;
  });

  // 3. Fix broken PDF character kerning
  cleaned = fixPdfKerning(cleaned);

  // 4. Preserve paragraph boundaries (\n\n) while unwrapping soft linebreaks inside paragraphs
  const rawParagraphs = cleaned.split(/\n\s*\n/);
  const formattedParagraphs = rawParagraphs
    .map(para => {
      let singleLine = para.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      singleLine = singleLine.replace(/([.,;:?!])([A-Za-z])/g, '$1 $2');
      return singleLine;
    })
    .filter(para => para.length > 0);

  return formattedParagraphs.join('\n\n');
}

export function fixPdfKerning(text: string): string {
  if (!text) return '';
  let res = text;

  const replacements: [RegExp, string][] = [
    [/\bGra\s+m\b/gi, 'Gram'],
    [/\bGra\s+m's\b/gi, "Gram's"],
    [/\bGra\s+m\s+staining\b/gi, 'Gram staining'],
    [/\bGra\s+m's\s+staining\b/gi, "Gram's staining"],
    [/\bGra\s+m\s+ne\s*ga\s*t\s*iv\s*e\b/gi, 'Gram negative'],
    [/\bGra\s+m\s+po\s*si\s*t\s*iv\s*e\b/gi, 'Gram positive'],
    [/\bmic\s*ro\s*sc\s*op\s*ic\b/gi, 'microscopic'],
    [/\bmic\s*ro\s*or\s*ga\s*ni\s*sms?\b/gi, 'microorganisms'],
    [/\borga\s*ni\s*sms?\b/gi, 'organisms'],
    [/\bep\s*it\s*heli\s*al\b/gi, 'epithelial'],
    [/\bco\s*loni\s*es\b/gi, 'colonies'],
    [/\bfo\s*ll\s*ow\s*in\s*g\b/gi, 'following'],
    [/\bpr\s*es\s*en\s*ce\b/gi, 'presence'],
    [/\bhe\s*re\s*dity\b/gi, 'heredity'],
    [/\bbioc\s*hemi\s*ca\s*l\b/gi, 'biochemical'],
    [/\br\s*ea\s*cti\s*ons?\b/gi, 'reactions'],
    [/\bOx\s*i\s*da\s*se\b/gi, 'Oxidase'],
    [/\bCitr\s*at\s*e\b/gi, 'Citrate'],
    [/\bNe\s*ga\s*t\s*iv\s*e\b/gi, 'Negative'],
    [/\bPo\s*si\s*t\s*iv\s*e\b/gi, 'Positive'],
    [/\bdel\s*ay\s*ed\b/gi, 'delayed'],
    [/\blac\s*t\s*os\s*e\b/gi, 'lactose'],
    [/\bma\s*nnit\s*ol\b/gi, 'mannitol'],
    [/\bxy\s*lo\s*se\b/gi, 'xylose'],
    [/\bfe\s*rmen\s*tat\s*io\s*n\b/gi, 'fermentation'],
    [/\bEsch\s*erichia\b/gi, 'Escherichia'],
    [/\bco\s*li\b/gi, 'coli'],
    [/\bTEX\s*TBOOK\b/gi, 'TEXTBOOK'],
    [/\bME\s*DICAL\b/gi, 'MEDICAL'],
    [/\bLABO\s*RATORY\b/gi, 'LABORATORY'],
    [/\bT\s*EC\s*HNOLOGY\b/gi, 'TECHNOLOGY'],
    [/\bV\.\s*D\.\s*R\.\s*L\.\b/gi, 'V.D.R.L.'],
    [/\bno\s*n\s*-\s*mo\s*tile\b/gi, 'non-motile'],
    [/\bMo\s*tility\b/gi, 'Motility'],
    [/\bCult\s*ura\s*l\b/gi, 'Cultural'],
    [/\bch\s*ar\s*ac\s*te\s*ris\s*tic\s*s\b/gi, 'characteristics'],
    [/\bpus\s+ce\s*lls?\b/gi, 'pus cells'],
    [/\bce\s*lls?\b/gi, 'cell']
  ];

  for (const [regex, replacement] of replacements) {
    res = res.replace(regex, replacement);
  }
  return res;
}

export function ensureProperSentenceStart(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();

  // If text starts with capital letter, bullet, or number, it's a valid sentence start
  if (/^([A-Z0-9"'\u2022\u2013\u2014-]|\u2022|\*)/.test(trimmed)) {
    return trimmed;
  }

  // Slice off orphan sentence fragment before the first capital letter sentence start
  const match = trimmed.match(/(?<=[.!?])\s+([A-Z][^]*)/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return trimmed;
}
