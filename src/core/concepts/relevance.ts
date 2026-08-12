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

  // Expository bonus
  const expositoryTerms = ['is a', 'refers to', 'defined as', 'used to', 'stain', 'principle', 'procedure', 'mechanism'];
  for (const term of expositoryTerms) {
    if (lowerP.includes(term)) score += 2;
  }

  // Unrelated noise penalty
  const noiseTerms = ['v.d.r.l.', 'vdrl', 'case 11', 'routine urine'];
  for (const noise of noiseTerms) {
    if (lowerP.includes(noise) && !lowerP.includes('principle of ' + primaryName)) {
      score -= 8;
    }
  }

  if (/^[A-Z]/.test(cleanP)) score += 1;

  return { paragraph: cleanP, score, containsTargetConcept };
}

