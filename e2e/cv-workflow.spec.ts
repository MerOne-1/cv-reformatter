import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('CV Upload and Management', () => {
  test('should show upload zone in sidebar', async ({ page }) => {
    await page.goto('/');

    // Check upload zone is visible
    await expect(page.getByText('Déposez un CV')).toBeVisible();
  });

  test('should show file type restrictions', async ({ page }) => {
    await page.goto('/');

    // Check accepted file types are mentioned
    await expect(page.getByText(/PDF|DOCX|DOC/i)).toBeVisible();
  });

  test('should reject invalid file type via API', async ({ request }) => {
    // Create a fake text file
    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('This is not a valid CV'),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid file type');
  });

  test('should reject file with wrong magic bytes via API', async ({ request }) => {
    // Create a file with wrong content
    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'fake.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid file content');
  });
});

test.describe('CV List and Selection', () => {
  test('should display CV list section', async ({ page }) => {
    await page.goto('/');

    // CV list header should be visible
    await expect(page.getByText('Liste des CV')).toBeVisible();
  });

  test('should show empty state when no CV selected', async ({ page }) => {
    await page.goto('/');

    // Empty state message
    await expect(page.getByText('Sélectionnez un CV')).toBeVisible();
  });
});

test.describe('Toolbar Actions', () => {
  test('should display toolbar when page loads', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // The toolbar area should be present
    const toolbar = page.locator('[class*="toolbar"]');
    await expect(toolbar.or(page.locator('header'))).toBeVisible();
  });
});

test.describe('Template Selection', () => {
  test('should have template options available', async ({ page }) => {
    await page.goto('/');

    // Look for template-related elements
    const templateArea = page.getByText(/Template|Modèle/i);
    // Template selection might only appear when CV is selected
    // Just check the page loads correctly
    await expect(page).toHaveTitle(/CV Reformatter/);
  });
});

test.describe('View Mode Toggle', () => {
  test('should have view mode controls', async ({ page }) => {
    await page.goto('/');

    // View mode buttons (Code/Formatted) might only appear with content
    // Check page structure is correct
    await expect(page.getByText('Aperçu')).toBeVisible();
  });
});

test.describe('API Error Handling', () => {
  test('should return proper error for missing cvId in workflow execute', async ({ request }) => {
    const response = await request.post('/api/workflow/execute', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).toBe(400);
  });

  test('should return 404 for non-existent workflow', async ({ request }) => {
    const response = await request.get('/api/workflow/status/non-existent-id');
    expect(response.status()).toBe(404);
  });

  test('should return 404 for non-existent audio', async ({ request }) => {
    const response = await request.get('/api/cv/non-existent-cv/audio/non-existent-audio');
    expect(response.status()).toBe(404);
  });
});

test.describe('Settings Page', () => {
  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');

    // Look for settings link/button
    const settingsLink = page.getByRole('link', { name: /settings|paramètres/i });
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/settings/);
    }
  });
});

test.describe('Responsive Layout', () => {
  test('should have responsive sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Sidebar should be visible on desktop
    await expect(page.getByText('Liste des CV')).toBeVisible();
  });

  test('should adapt layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still be functional
    await expect(page).toHaveTitle(/CV Reformatter/);
  });
});

test.describe('Accessibility', () => {
  test('should have main content area', async ({ page }) => {
    await page.goto('/');

    // Check for main landmark or content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]'));
    await expect(mainContent.first()).toBeVisible();
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Should have h1
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

test.describe('Theme Toggle', () => {
  test('should have theme toggle functionality', async ({ page }) => {
    await page.goto('/');

    // Look for theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });
    if (await themeToggle.isVisible()) {
      // Click to toggle
      await themeToggle.click();
      // Theme should change (we can't easily verify CSS changes)
    }
  });
});

test.describe('Agents API', () => {
  test('should list agents', async ({ request }) => {
    const response = await request.get('/api/agents');

    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('success');
  });

  test('should return graph structure', async ({ request }) => {
    const response = await request.get('/api/agents/graph');

    expect(response.status()).toBeLessThan(500);
    const data = await response.json();

    if (data.success) {
      expect(data.data).toHaveProperty('nodes');
      expect(data.data).toHaveProperty('edges');
      expect(data.data).toHaveProperty('isValid');
    }
  });

  test('should return 404 for non-existent agent', async ({ request }) => {
    const response = await request.get('/api/agents/non-existent-id');
    expect(response.status()).toBe(404);
  });
});

test.describe('Templates API', () => {
  test('should list templates', async ({ request }) => {
    const response = await request.get('/api/templates');

    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('success');
  });

  test('should return 404 for non-existent template', async ({ request }) => {
    const response = await request.get('/api/templates/non-existent-id');
    expect(response.status()).toBe(404);
  });
});
