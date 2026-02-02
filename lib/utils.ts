import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isValidCVFile(filename: string): boolean {
  const validExtensions = ['pdf', 'docx', 'doc'];
  return validExtensions.includes(getFileExtension(filename));
}

/**
 * Magic bytes for CV file validation
 * PDF: %PDF (25 50 44 46)
 * DOCX/DOC (Office Open XML): PK (50 4B 03 04) - ZIP format
 * DOC (OLE2): D0 CF 11 E0
 */
const CV_MAGIC_BYTES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  docx: [[0x50, 0x4b, 0x03, 0x04]], // PK (ZIP)
  doc: [
    [0x50, 0x4b, 0x03, 0x04], // PK (ZIP) - newer .doc can be OOXML
    [0xd0, 0xcf, 0x11, 0xe0], // OLE2 compound document
  ],
};

/**
 * Validates that file content matches expected magic bytes for CV files (PDF, DOC, DOCX)
 */
export function validateCVMagicBytes(buffer: Buffer, extension: string): boolean {
  const ext = extension.toLowerCase();
  const signatures = CV_MAGIC_BYTES[ext];

  if (!signatures) {
    return false;
  }

  return signatures.some(magic =>
    magic.every((byte, i) => buffer[i] === byte)
  );
}

export function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const VALID_EXTENSIONS = ['pdf', 'docx', 'doc'];

export function generateRawFilename(consultantName: string, extension: string): string {
  if (!extension || !VALID_EXTENSIONS.includes(extension.toLowerCase())) {
    throw new Error(`Invalid file extension: "${extension}". Must be one of: ${VALID_EXTENSIONS.join(', ')}`);
  }

  const sanitized = consultantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!sanitized) {
    throw new Error(`Invalid consultant name for filename generation: "${consultantName}" sanitized to empty string`);
  }

  return `${sanitized}.${extension}`;
}

/**
 * Extracts initials from a name (e.g., "Jean Dupont" -> "JD")
 * Returns fallback if name is empty or whitespace-only
 */
export function getInitials(name: string, fallback = 'XX'): string {
  const initials = name
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return initials || fallback;
}

/**
 * Returns the MIME content type for a file extension
 */
export function getContentTypeForExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
    case 'doc':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function extractConsultantNameFromFilename(filename: string): string | null {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(pdf|docx|doc)$/i, '');

  // Try to extract name (common patterns: CV_Prenom_Nom, Prenom-Nom_CV, etc.)
  const patterns = [
    /^CV[_-]?(.+)/i,
    /(.+)[_-]?CV$/i,
    /^(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return match[1]
        .replace(/[_-]/g, ' ')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Tentative ${attempt + 1}/${maxRetries} échouée:`, lastError.message);

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
