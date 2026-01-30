import { prisma } from '@/lib/db';
import { uploadFile, deleteFile } from '@/lib/b2';
import {
  TemplateWithParsedConfig,
  toTemplateWithParsedConfig,
} from './types';

const TEMPLATES_PREFIX = 'templates';
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];

// Result type for operations that can fail in expected ways
export interface LogoLoadResult {
  buffer: Buffer | null;
  error?: string;
  loaded: boolean;
}

/**
 * Load logo image from URL (B2 or any public URL)
 * Returns result object with buffer and error info for better debugging
 */
export async function loadLogoFromUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Logo fetch failed [${response.status}]: ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Logo load error for ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Load logo with detailed result (for callers that need to distinguish "no logo" from "load failed")
 */
export async function loadLogoWithResult(url: string | null | undefined): Promise<LogoLoadResult> {
  if (!url) {
    return { buffer: null, loaded: true }; // No logo configured - not an error
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        buffer: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        loaded: false,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), loaded: true };
  } catch (error) {
    return {
      buffer: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      loaded: false,
    };
  }
}

/**
 * Get template by name with parsed config
 */
export async function getTemplateByName(name: string): Promise<TemplateWithParsedConfig | null> {
  const template = await prisma.template.findUnique({
    where: { name: name.toUpperCase() },
  });

  if (!template) return null;

  return toTemplateWithParsedConfig(template);
}

/**
 * Get template by ID with parsed config
 */
export async function getTemplateById(id: string): Promise<TemplateWithParsedConfig | null> {
  const template = await prisma.template.findUnique({
    where: { id },
  });

  if (!template) return null;

  return toTemplateWithParsedConfig(template);
}

/**
 * Get all active templates with parsed config
 */
export async function getAllActiveTemplates(): Promise<TemplateWithParsedConfig[]> {
  const templates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return templates.map(toTemplateWithParsedConfig);
}

/**
 * Sanitize and validate file extension
 * Prevents path traversal by only allowing whitelisted extensions
 */
function getSafeExtension(filename: string): string {
  // Extract only the extension, ignoring any path components
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;

  // Only allow whitelisted extensions
  if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
    return ext;
  }
  return 'png'; // Safe default
}

/**
 * Get content type from filename extension
 */
function getImageContentType(filename: string): string {
  const ext = getSafeExtension(filename);
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

/**
 * Upload template logo to B2 and update database
 * Returns the public URL of the uploaded logo
 * @param type - 'main' for single logo (logoUrl), 'header' or 'footer' for specific placement
 */
export async function uploadTemplateLogo(
  templateId: string,
  type: 'main' | 'header' | 'footer',
  buffer: Buffer,
  filename: string
): Promise<string> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Use sanitized extension (prevents path traversal)
  const extension = getSafeExtension(filename);
  const logoType = type === 'main' ? 'logo' : `logo-${type}`;
  const key = `${TEMPLATES_PREFIX}/${template.name.toLowerCase()}/${logoType}.${extension}`;

  // Get content type
  const contentType = getImageContentType(filename);

  // Upload to B2
  const url = await uploadFile(key, buffer, contentType);

  // Update database - 'main' uses logoUrl, others use logoHeaderUrl/logoFooterUrl
  const updateField = type === 'main' ? 'logoUrl' : type === 'header' ? 'logoHeaderUrl' : 'logoFooterUrl';
  await prisma.template.update({
    where: { id: templateId },
    data: { [updateField]: url },
  });

  return url;
}

/**
 * Delete template logo from B2
 * Extracts key from URL and deletes the file
 * Throws on error to allow caller to handle appropriately
 */
export async function deleteTemplateLogo(url: string): Promise<void> {
  if (!url) return;

  // Parse URL to extract key
  let key: string;
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    // Remove empty first element and bucket name
    key = pathParts.slice(2).join('/');
  } catch (parseError) {
    throw new Error(`Invalid logo URL format: ${url}`);
  }

  if (!key) {
    throw new Error(`Could not extract key from URL: ${url}`);
  }

  // Delete file - propagate errors to caller
  await deleteFile(key);
}

/**
 * Get logo key from template name and type
 */
export function getTemplateLogoKey(templateName: string, type: 'header' | 'footer', extension = 'png'): string {
  const safeExt = ALLOWED_EXTENSIONS.includes(extension.toLowerCase()) ? extension.toLowerCase() : 'png';
  return `${TEMPLATES_PREFIX}/${templateName.toLowerCase()}/logo-${type}.${safeExt}`;
}
