import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  getFileExtension,
  isValidCVFile,
  sanitizeFilename,
  truncateText,
  extractConsultantNameFromFilename,
} from '@/lib/utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6');
  });
});

describe('formatDate', () => {
  it('should format date in French format', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('15/01/2024');
  });

  it('should handle string dates', () => {
    expect(formatDate('2024-06-20')).toBe('20/06/2024');
  });
});

describe('getFileExtension', () => {
  it('should return lowercase extension', () => {
    expect(getFileExtension('document.PDF')).toBe('pdf');
    expect(getFileExtension('cv.DOCX')).toBe('docx');
  });

  it('should handle multiple dots', () => {
    expect(getFileExtension('my.cv.v2.pdf')).toBe('pdf');
  });

  it('should return empty string for no extension', () => {
    expect(getFileExtension('noextension')).toBe('noextension');
  });
});

describe('isValidCVFile', () => {
  it('should accept valid CV formats', () => {
    expect(isValidCVFile('cv.pdf')).toBe(true);
    expect(isValidCVFile('cv.docx')).toBe(true);
    expect(isValidCVFile('cv.doc')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidCVFile('cv.txt')).toBe(false);
    expect(isValidCVFile('cv.xlsx')).toBe(false);
    expect(isValidCVFile('image.png')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('should remove accents', () => {
    expect(sanitizeFilename('café.pdf')).toBe('cafe.pdf');
    expect(sanitizeFilename('résumé.docx')).toBe('resume.docx');
  });

  it('should replace special characters', () => {
    expect(sanitizeFilename('my file (1).pdf')).toBe('my_file_1_.pdf');
  });

  it('should collapse multiple underscores', () => {
    expect(sanitizeFilename('a___b___c.pdf')).toBe('a_b_c.pdf');
  });
});

describe('truncateText', () => {
  it('should not truncate short text', () => {
    expect(truncateText('short', 10)).toBe('short');
  });

  it('should truncate long text with ellipsis', () => {
    expect(truncateText('this is a very long text', 10)).toBe('this is...');
  });
});

describe('extractConsultantNameFromFilename', () => {
  it('should extract name from CV_Prenom_Nom format', () => {
    expect(extractConsultantNameFromFilename('CV_Jean_Dupont.pdf')).toBe('Jean Dupont');
  });

  it('should extract name from Prenom-Nom_CV format', () => {
    expect(extractConsultantNameFromFilename('Marie-Claire_CV.docx')).toBe('Marie Claire');
  });

  it('should handle simple names', () => {
    expect(extractConsultantNameFromFilename('Pierre_Martin.pdf')).toBe('Pierre Martin');
  });
});
