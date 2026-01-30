'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { useMemo } from 'react';

// Using Helvetica (built-in font) - no custom font registration needed
// Custom fonts from Google Fonts cause issues with react-pdf in browser

interface CVPdfDocumentProps {
  markdown: string;
  brandName: string;
  brandColors: {
    primary: string;
    secondary: string;
  };
  logoUrl?: string | null;
  logoBase64?: string | null;
  website?: string | null;
  consultantName?: string;
}

interface ParsedSection {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'separator';
  content: string;
  items?: string[];
}

// Parse markdown to sections
function parseMarkdown(markdown: string): ParsedSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      sections.push({ type: 'list', content: '', items: [...currentList] });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      flushList();
      sections.push({ type: 'heading3', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      flushList();
      sections.push({ type: 'heading2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      flushList();
      sections.push({ type: 'heading1', content: trimmed.slice(2) });
    } else if (trimmed === '---') {
      flushList();
      sections.push({ type: 'separator', content: '' });
    } else if (trimmed.startsWith('- ')) {
      currentList.push(trimmed.slice(2));
    } else {
      flushList();
      sections.push({ type: 'paragraph', content: trimmed });
    }
  }

  flushList();
  return sections;
}

// Format text with bold/italic
function formatText(text: string, styles: ReturnType<typeof createStyles>) {
  // Simple bold handling - split by ** and alternate
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Bold text
      return <Text key={i} style={styles.bold}>{part}</Text>;
    }
    return part;
  });
}

const createStyles = (colors: { primary: string; secondary: string }) =>
  StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 10,
      paddingTop: 80,
      paddingBottom: 60,
      paddingHorizontal: 50,
      color: '#1f2937',
    },
    header: {
      position: 'absolute',
      top: 20,
      left: 50,
      right: 50,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLogo: {
      height: 55,
      objectFit: 'contain',
    },
    headerBrandText: {
      fontSize: 14,
      fontWeight: 700,
      color: colors.primary,
    },
    headerInitials: {
      fontSize: 12,
      fontWeight: 700,
      color: colors.primary,
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 50,
      right: 50,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 8,
      color: '#6b7280',
    },
    footerLogo: {
      height: 20,
      objectFit: 'contain',
    },
    content: {
      flex: 1,
    },
    heading1: {
      fontSize: 18,
      fontWeight: 700,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    heading2: {
      fontSize: 13,
      fontWeight: 600,
      color: colors.primary,
      marginTop: 16,
      marginBottom: 8,
      paddingBottom: 4,
      borderBottomWidth: 2,
      borderBottomColor: colors.secondary,
    },
    heading3: {
      fontSize: 11,
      fontWeight: 600,
      color: colors.secondary,
      marginTop: 10,
      marginBottom: 4,
    },
    paragraph: {
      fontSize: 10,
      lineHeight: 1.5,
      marginBottom: 6,
    },
    listItem: {
      fontSize: 10,
      lineHeight: 1.5,
      marginBottom: 3,
      paddingLeft: 15,
    },
    bullet: {
      position: 'absolute',
      left: 0,
    },
    separator: {
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      marginVertical: 10,
    },
    bold: {
      fontWeight: 600,
    },
    missingInfo: {
      backgroundColor: '#fef3c7',
      color: '#92400e',
      padding: '2 6',
      borderRadius: 3,
      fontSize: 8,
    },
  });

export function CVPdfDocument({
  markdown,
  brandName,
  brandColors,
  logoUrl,
  logoBase64,
  website,
  consultantName,
}: CVPdfDocumentProps) {
  // Prefer base64 (from proxy) over URL for CORS compatibility
  const logoSrc = logoBase64 || logoUrl;
  const styles = useMemo(() => createStyles(brandColors), [brandColors]);
  const sections = useMemo(() => parseMarkdown(markdown), [markdown]);

  // Extract consultant name from first heading1 in markdown (like DOCX generator does)
  const extractedName = useMemo(() => {
    const firstHeading = sections.find(s => s.type === 'heading1');
    return firstHeading?.content || consultantName || '';
  }, [sections, consultantName]);

  const initials = useMemo(() => {
    if (!extractedName) return '';
    const words = extractedName.split(/\s+/).filter(word => word.length > 0);
    // If single word of 2-3 chars (likely already initials), use as-is
    if (words.length === 1 && words[0].length <= 3) {
      return words[0].toUpperCase();
    }
    // Otherwise, take first letter of each word
    return words.map(word => word.charAt(0).toUpperCase()).join('');
  }, [extractedName]);

  // Split sections into pages (rough estimate: ~25 items per page)
  const itemsPerPage = 25;
  const pages: ParsedSection[][] = [];
  let currentPage: ParsedSection[] = [];
  let itemCount = 0;

  for (const section of sections) {
    const sectionWeight = section.type === 'heading1' ? 3 :
      section.type === 'heading2' ? 2 :
      section.type === 'list' ? (section.items?.length || 1) : 1;

    if (itemCount + sectionWeight > itemsPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      itemCount = 0;
    }

    currentPage.push(section);
    itemCount += sectionWeight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const totalPages = pages.length || 1;

  return (
    <Document>
      {pages.map((pageSections, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header} fixed>
            {logoSrc ? (
              <Image src={logoSrc} style={styles.headerLogo} />
            ) : (
              <Text style={styles.headerBrandText}>{brandName}</Text>
            )}
            <Text style={styles.headerInitials}>{initials}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {pageSections.map((section, idx) => {
              switch (section.type) {
                case 'heading1':
                  return (
                    <Text key={idx} style={styles.heading1}>
                      {section.content}
                    </Text>
                  );
                case 'heading2':
                  return (
                    <Text key={idx} style={styles.heading2}>
                      {section.content.toUpperCase()}
                    </Text>
                  );
                case 'heading3':
                  return (
                    <Text key={idx} style={styles.heading3}>
                      {section.content}
                    </Text>
                  );
                case 'paragraph':
                  return (
                    <Text key={idx} style={styles.paragraph}>
                      {formatText(section.content, styles)}
                    </Text>
                  );
                case 'list':
                  return (
                    <View key={idx}>
                      {section.items?.map((item, i) => (
                        <View key={i} style={{ flexDirection: 'row' }}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.listItem}>
                            {formatText(item, styles)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                case 'separator':
                  return <View key={idx} style={styles.separator} />;
                default:
                  return null;
              }
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            {logoSrc ? (
              <Image src={logoSrc} style={styles.footerLogo} />
            ) : (
              <Text>{brandName}</Text>
            )}
            <Text>{pageIndex + 1}/{totalPages}</Text>
            <Text>{website || ''}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
