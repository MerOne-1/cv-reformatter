import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { uploadTemplateLogo, deleteTemplateLogo } from '@/lib/templates/template-utils';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic bytes for image validation
const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46],
};

function validateImageMagicBytes(buffer: Buffer): boolean {
  return Object.values(IMAGE_MAGIC_BYTES).some(magic =>
    magic.every((byte, i) => buffer[i] === byte)
  );
}

function validateLogoType(typeParam: string | null): typeParam is 'main' | 'header' | 'footer' {
  return typeParam === 'main' || typeParam === 'header' || typeParam === 'footer';
}

// POST /api/templates/[id]/logo?type=header|footer
// Upload a logo for the template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate type query param (validate BEFORE type assertion)
    // 'main' is the default for single logo templates
    const typeParam = request.nextUrl.searchParams.get('type') || 'main';
    if (!validateLogoType(typeParam)) {
      return NextResponse.json(
        { success: false, error: 'Query param "type" must be "main", "header" or "footer"' },
        { status: 400 }
      );
    }
    const type = typeParam; // Now safely typed as 'main' | 'header' | 'footer'

    // Check template exists
    const template = await prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (MIME header - first check)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Read buffer and validate magic bytes (second check - server-side)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateImageMagicBytes(buffer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image content. File does not match expected image format.' },
        { status: 400 }
      );
    }

    // Delete old logo if exists (log but don't block on failure)
    const oldLogoUrl = type === 'main' ? template.logoUrl : type === 'header' ? template.logoHeaderUrl : template.logoFooterUrl;
    if (oldLogoUrl) {
      try {
        await deleteTemplateLogo(oldLogoUrl);
      } catch (err) {
        console.warn(`Failed to delete old ${type} logo (orphan file may remain):`, oldLogoUrl, err);
      }
    }

    // Upload new logo
    const url = await uploadTemplateLogo(id, type, buffer, file.name);

    return NextResponse.json({
      success: true,
      data: { url, type },
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id]/logo?type=header|footer
// Delete a logo from the template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate type query param (validate BEFORE type assertion)
    const typeParam = request.nextUrl.searchParams.get('type') || 'main';
    if (!validateLogoType(typeParam)) {
      return NextResponse.json(
        { success: false, error: 'Query param "type" must be "main", "header" or "footer"' },
        { status: 400 }
      );
    }
    const type = typeParam;

    // Get template
    const template = await prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Get logo URL to delete
    const logoUrl = type === 'main' ? template.logoUrl : type === 'header' ? template.logoHeaderUrl : template.logoFooterUrl;

    if (!logoUrl) {
      return NextResponse.json(
        { success: false, error: 'No logo to delete' },
        { status: 400 }
      );
    }

    // Delete from B2 (propagate error if fails)
    await deleteTemplateLogo(logoUrl);

    // Update database only after successful B2 deletion
    const updateField = type === 'main' ? 'logoUrl' : type === 'header' ? 'logoHeaderUrl' : 'logoFooterUrl';
    await prisma.template.update({
      where: { id },
      data: { [updateField]: null },
    });

    return NextResponse.json({
      success: true,
      message: `${type} logo deleted`,
    });
  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
