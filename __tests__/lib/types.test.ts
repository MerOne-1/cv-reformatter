import { describe, it, expect } from 'vitest';
import { detectMissingFields, MISSING_INFO_MARKER } from '@/lib/types';

describe('detectMissingFields', () => {
  describe('blockquote format detection', () => {
    it('should detect missing fields in blockquote format', () => {
      const markdown = `
# CV

> **Informations à compléter :**
> - Années d'expérience
> - Niveau d'études
> - Certifications

## Résumé Professionnel
`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Années d\'expérience');
      expect(result).toContain('Niveau d\'études');
      expect(result).toContain('Certifications');
      expect(result).toHaveLength(3);
    });

    it('should ignore blockquote headers starting with **', () => {
      const markdown = `
> **Informations à compléter :**
> - Champ manquant 1
`;
      const result = detectMissingFields(markdown);

      expect(result).not.toContain('Informations à compléter :');
      expect(result).toContain('Champ manquant 1');
    });

    it('should handle multiple blockquote sections', () => {
      const markdown = `
> - Premier champ

## Section

> - Deuxième champ
`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Premier champ');
      expect(result).toContain('Deuxième champ');
    });
  });

  describe('legacy format detection (##INFO MANQUANTE##)', () => {
    it('should detect legacy missing info markers', () => {
      const markdown = `
# CV

## Expériences

${MISSING_INFO_MARKER} [Dates de mission]
${MISSING_INFO_MARKER} [Nom du client]
`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Dates de mission');
      expect(result).toContain('Nom du client');
    });

    it('should handle marker with extra whitespace', () => {
      const markdown = `${MISSING_INFO_MARKER}   [Info avec espaces]`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Info avec espaces');
    });

    it('should handle marker inline with text', () => {
      const markdown = `Texte avant ${MISSING_INFO_MARKER} [Info inline] texte après`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Info inline');
    });
  });

  describe('[À compléter] placeholder detection', () => {
    it('should detect [À compléter] placeholders', () => {
      const markdown = `
# CV

**Nom:** [À compléter]
**Email:** [À compléter]
`;
      const result = detectMissingFields(markdown);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('2 champ(s) à compléter');
    });

    it('should be case insensitive for [À compléter]', () => {
      const markdown = `
**Champ 1:** [à compléter]
**Champ 2:** [À COMPLÉTER]
`;
      const result = detectMissingFields(markdown);

      expect(result[0]).toContain('2 champ(s) à compléter');
    });

    it('should not add placeholder count if other markers are found', () => {
      const markdown = `
> - Champ explicite

**Autre:** [À compléter]
`;
      const result = detectMissingFields(markdown);

      // Should have the explicit field but not the generic count
      expect(result).toContain('Champ explicite');
      expect(result).not.toContain('champ(s) à compléter');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for markdown without missing fields', () => {
      const markdown = `
# CV Complet

## Résumé
Expert en développement web.

## Expériences
- 5 ans chez Entreprise X
`;
      const result = detectMissingFields(markdown);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty markdown', () => {
      const result = detectMissingFields('');
      expect(result).toHaveLength(0);
    });

    it('should deduplicate identical missing fields', () => {
      const markdown = `
> - Champ dupliqué
> - Champ dupliqué
> - Champ dupliqué
`;
      const result = detectMissingFields(markdown);

      expect(result).toHaveLength(1);
      expect(result).toContain('Champ dupliqué');
    });

    it('should handle mixed formats', () => {
      const markdown = `
> - Champ blockquote

${MISSING_INFO_MARKER} [Champ legacy]
`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Champ blockquote');
      expect(result).toContain('Champ legacy');
    });

    it('should trim whitespace from detected fields', () => {
      const markdown = `
> -    Champ avec espaces
`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Champ avec espaces');
    });

    it('should handle special characters in field names', () => {
      const markdown = `
> - Champ (avec parenthèses)
> - Champ [avec crochets]
> - Champ "avec guillemets"
`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Champ (avec parenthèses)');
      expect(result).toContain('Champ [avec crochets]');
      expect(result).toContain('Champ "avec guillemets"');
    });

    it('should handle multiline content', () => {
      const markdown = `# Titre
> - Ligne 1
>
> - Ligne 2

Autre contenu

> - Ligne 3`;
      const result = detectMissingFields(markdown);

      expect(result).toContain('Ligne 1');
      expect(result).toContain('Ligne 2');
      expect(result).toContain('Ligne 3');
    });
  });
});

describe('MISSING_INFO_MARKER', () => {
  it('should be the correct marker string', () => {
    expect(MISSING_INFO_MARKER).toBe('##INFO MANQUANTE##');
  });
});
