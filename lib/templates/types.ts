import { z } from 'zod';
import { Template } from '@prisma/client';

// === LOGO CONFIG ===
export const LogoPositionSchema = z.enum(['top-left', 'top-center', 'top-right', 'center', 'left', 'right']);

export const HeaderLogoConfigSchema = z.object({
  width: z.number().min(100).max(10000).default(1800),      // twips (1 inch = 1440)
  height: z.number().min(50).max(5000).default(600),
  marginTop: z.number().min(0).max(5000).default(360),   // 0.25 inch
  marginLeft: z.number().min(0).max(5000).default(360),
  position: LogoPositionSchema.default('top-left'),
});

export const FooterLogoConfigSchema = z.object({
  width: z.number().min(100).max(10000).default(1200),
  height: z.number().min(50).max(5000).default(400),
  position: LogoPositionSchema.default('center'),
});

export const LogosConfigSchema = z.object({
  header: HeaderLogoConfigSchema.optional(),
  footer: FooterLogoConfigSchema.optional(),
}).default({});

// === MARGINS CONFIG ===
export const MarginsConfigSchema = z.object({
  top: z.number().min(0).max(5000).default(1800),        // 1.25 inch (espace pour logo header)
  bottom: z.number().min(0).max(5000).default(1440),     // 1 inch
  left: z.number().min(0).max(5000).default(1080),       // 0.75 inch
  right: z.number().min(0).max(5000).default(1080),      // 0.75 inch
}).default({});

// === FONTS CONFIG ===
export const FontsConfigSchema = z.object({
  family: z.string().default('Arial'),
  titleSize: z.number().default(48),
  heading2Size: z.number().default(28),
  heading3Size: z.number().default(22),
  bodySize: z.number().default(22),
  smallSize: z.number().default(18),
}).default({});

// === SPACING CONFIG ===
export const SpacingConfigSchema = z.object({
  afterTitle: z.number().default(400),
  afterHeading2: z.number().default(200),
  afterHeading3: z.number().default(100),
  afterParagraph: z.number().default(120),
  afterListItem: z.number().default(60),
  beforeSection: z.number().default(300),
  experienceSeparator: z.number().default(200),
}).default({});

// === PAGINATION CONFIG ===
export const PaginationConfigSchema = z.object({
  keepWithNext: z.boolean().default(true),      // Heading + premier paragraphe ensemble
  keepLines: z.boolean().default(true),         // Pas de ligne orpheline
  widowControl: z.boolean().default(true),      // Min 2 lignes en haut de page
}).default({});

// === STYLES CONFIG ===
export const StylesConfigSchema = z.object({
  heading2Uppercase: z.boolean().default(true),
  heading2Border: z.boolean().default(true),
  initialsStyle: z.enum(['circle', 'square', 'none']).default('none'),
}).default({});

// === SECTIONS CONFIG ===
export const SectionTypeSchema = z.enum([
  'initials',
  'title',
  'keySkills',
  'bio',
  'competences',
  'experience',
  'formations',
  'certifications',
  'projetsPersonnels',
  'langues',
]);

export const SectionsConfigSchema = z.array(SectionTypeSchema).default([
  'initials',
  'title',
  'keySkills',
  'bio',
  'competences',
  'experience',
  'formations',
  'certifications',
  'projetsPersonnels',
  'langues',
]);

// === MAIN TEMPLATE CONFIG SCHEMA ===
export const TemplateConfigSchema = z.object({
  logos: LogosConfigSchema,
  margins: MarginsConfigSchema,
  fonts: FontsConfigSchema,
  spacing: SpacingConfigSchema,
  pagination: PaginationConfigSchema,
  styles: StylesConfigSchema,
  sections: SectionsConfigSchema,
  // Legacy/extra fields for backward compatibility
  website: z.string().optional(),
  headerStyle: z.string().optional(),
  incomplete: z.boolean().optional(),
}).default({
  logos: {},
  margins: {},
  fonts: {},
  spacing: {},
  pagination: {},
  styles: {},
  sections: [
    'initials', 'title', 'keySkills', 'bio', 'competences',
    'experience', 'formations', 'certifications', 'projetsPersonnels', 'langues'
  ],
});

// Inferred types
export type LogoPosition = z.infer<typeof LogoPositionSchema>;
export type HeaderLogoConfig = z.infer<typeof HeaderLogoConfigSchema>;
export type FooterLogoConfig = z.infer<typeof FooterLogoConfigSchema>;
export type LogosConfig = z.infer<typeof LogosConfigSchema>;
export type MarginsConfig = z.infer<typeof MarginsConfigSchema>;
export type FontsConfig = z.infer<typeof FontsConfigSchema>;
export type SpacingConfig = z.infer<typeof SpacingConfigSchema>;
export type PaginationConfig = z.infer<typeof PaginationConfigSchema>;
export type StylesConfig = z.infer<typeof StylesConfigSchema>;
export type SectionType = z.infer<typeof SectionTypeSchema>;
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

// Template with parsed config
export interface TemplateWithParsedConfig extends Omit<Template, 'config'> {
  config: TemplateConfig;
}

/**
 * Parse and validate template config JSON string
 * Returns config with defaults applied for missing fields
 */
export function parseTemplateConfig(configJson: string | null | undefined): TemplateConfig {
  if (!configJson) {
    return TemplateConfigSchema.parse({});
  }

  try {
    const parsed = JSON.parse(configJson);
    return TemplateConfigSchema.parse(parsed);
  } catch {
    // If parsing fails, return defaults
    console.warn('Failed to parse template config, using defaults');
    return TemplateConfigSchema.parse({});
  }
}

/**
 * Stringify template config for storage
 */
export function stringifyTemplateConfig(config: TemplateConfig): string {
  return JSON.stringify(config);
}

/**
 * Convert Prisma Template to TemplateWithParsedConfig
 */
export function toTemplateWithParsedConfig(template: Template): TemplateWithParsedConfig {
  return {
    ...template,
    config: parseTemplateConfig(template.config),
  };
}
