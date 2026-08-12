import { cleanExtractedText, ensureProperSentenceStart } from './normalize';

export interface ScoredParagraph {
  paragraph: string;
  score: number;
  containsTargetConcept: boolean;
}

export function getConceptKeywords(conceptName: string): string[] {
  const norm = conceptName.trim().toLowerCase();
  const keywords = new Set<string>([norm]);

  if (norm === 'dna') {
    keywords.add('deoxyribonucleic acid');
    keywords.add('double helix');
    keywords.add('nucleic acid');
    keywords.add('genetic material');
  } else if (norm.includes('gram stain') || norm.includes('gram staining')) {
    keywords.add('gram staining');
    keywords.add("gram's staining");
    keywords.add('gram stain');
    keywords.add('gram-staining');
    keywords.add('gram positive');
    keywords.add('gram negative');
    keywords.add('gram');
  } else {
    keywords.add(`${norm}'s`);
    keywords.add(`${norm}s`);
  }

  return Array.from(keywords);
}

export function scoreParagraph(paragraph: string, conceptName: string): ScoredParagraph {
  const cleanP = cleanExtractedText(paragraph);
  const keywords = getConceptKeywords(conceptName);
  const lowerP = cleanP.toLowerCase();
  const primaryName = conceptName.trim().toLowerCase();

  let score = 0;
  let containsTargetConcept = false;

  if (lowerP.includes(primaryName)) {
    score += 10;
    containsTargetConcept = true;
  }

  for (const kw of keywords) {
    if (kw === primaryName) continue;
    if (lowerP.includes(kw)) {
      score += 5;
      containsTargetConcept = true;
    }
  }

  if (!containsTargetConcept) {
    return { paragraph: cleanP, score: 0, containsTargetConcept: false };
  }

  const expositoryTerms = ['is a', 'refers to', 'defined as', 'used to', 'stain', 'principle', 'procedure', 'mechanism'];
  for (const term of expositoryTerms) {
    if (lowerP.includes(term)) score += 2;
  }

  const noiseTerms = ['v.d.r.l.', 'vdrl', 'case 11', 'routine urine'];
  for (const noise of noiseTerms) {
    if (lowerP.includes(noise) && !lowerP.includes('principle of ' + primaryName)) {
      score -= 8;
    }
  }

  if (/^[A-Z]/.test(cleanP)) score += 1;

  return { paragraph: cleanP, score, containsTargetConcept };
}

export function scorePageRelevance(
  pageText: string,
  conceptName: string
): { score: number; tier: 'high' | 'relevant' | 'low' } {
  if (!pageText || !conceptName) return { score: 0, tier: 'low' };
  const clean = cleanExtractedText(pageText);
  const scored = scoreParagraph(clean, conceptName);
  let tier: 'high' | 'relevant' | 'low' = 'low';
  if (scored.score >= 10) tier = 'high';
  else if (scored.score > 0) tier = 'relevant';
  return { score: scored.score, tier };
}

export function findBestExcerpt(pageText: string, conceptName: string): string {
  if (!pageText) return '';
  const clean = cleanExtractedText(pageText);
  const paragraphs = clean.split(/\n\s*\n/);
  let bestP = '';
  let maxScore = -1;

  for (const p of paragraphs) {
    const scored = scoreParagraph(p, conceptName);
    if (scored.score > maxScore) {
      maxScore = scored.score;
      bestP = scored.paragraph;
    }
  }

  return ensureProperSentenceStart(bestP);
}
