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
  generateRawFilename,
  getInitials,
  getContentTypeForExtension,
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

describe('generateRawFilename', () => {
  it('should generate filename with full name', () => {
    expect(generateRawFilename('Jean Dupont', 'pdf')).toBe('Jean_Dupont.pdf');
  });

  it('should sanitize accented characters', () => {
    expect(generateRawFilename('José García', 'docx')).toBe('Jose_Garcia.docx');
  });

  it('should handle multiple spaces', () => {
    expect(generateRawFilename('Jean  Pierre  Dupont', 'pdf')).toBe('Jean_Pierre_Dupont.pdf');
  });

  it('should remove special characters and trim underscores', () => {
    expect(generateRawFilename('Jean-Pierre Dupont (Jr)', 'pdf')).toBe('Jean_Pierre_Dupont_Jr.pdf');
  });

  it('should throw error for empty name', () => {
    expect(() => generateRawFilename('', 'pdf')).toThrow('Invalid consultant name');
  });

  it('should throw error for whitespace-only name', () => {
    expect(() => generateRawFilename('   ', 'pdf')).toThrow('Invalid consultant name');
  });

  it('should throw error for special-chars-only name', () => {
    expect(() => generateRawFilename('###', 'pdf')).toThrow('Invalid consultant name');
  });

  it('should throw error for empty extension', () => {
    expect(() => generateRawFilename('Jean Dupont', '')).toThrow('Invalid file extension');
  });

  it('should throw error for invalid extension', () => {
    expect(() => generateRawFilename('Jean Dupont', 'exe')).toThrow('Invalid file extension');
  });

  it('should accept valid extensions (pdf, docx, doc)', () => {
    expect(generateRawFilename('Jean Dupont', 'pdf')).toBe('Jean_Dupont.pdf');
    expect(generateRawFilename('Jean Dupont', 'docx')).toBe('Jean_Dupont.docx');
    expect(generateRawFilename('Jean Dupont', 'doc')).toBe('Jean_Dupont.doc');
  });
});

describe('getInitials', () => {
  it('should extract initials from full name', () => {
    expect(getInitials('Jean Dupont')).toBe('JD');
  });

  it('should handle single name', () => {
    expect(getInitials('Madonna')).toBe('M');
  });

  it('should handle multiple names', () => {
    expect(getInitials('Jean Pierre Marie Dupont')).toBe('JPMD');
  });

  it('should return fallback for empty name', () => {
    expect(getInitials('')).toBe('XX');
  });

  it('should return fallback for whitespace-only name', () => {
    expect(getInitials('   ')).toBe('XX');
  });

  it('should use custom fallback', () => {
    expect(getInitials('', 'NA')).toBe('NA');
  });

  it('should handle names with multiple spaces', () => {
    expect(getInitials('Jean   Pierre')).toBe('JP');
  });
});

describe('getContentTypeForExtension', () => {
  it('should return correct MIME type for pdf', () => {
    expect(getContentTypeForExtension('pdf')).toBe('application/pdf');
  });

  it('should return correct MIME type for docx', () => {
    expect(getContentTypeForExtension('docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('should return correct MIME type for doc', () => {
    expect(getContentTypeForExtension('doc')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('should handle uppercase extensions', () => {
    expect(getContentTypeForExtension('PDF')).toBe('application/pdf');
  });

  it('should return octet-stream for unknown extensions', () => {
    expect(getContentTypeForExtension('xyz')).toBe('application/octet-stream');
  });
});
