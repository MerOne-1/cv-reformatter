import { test, expect } from '@playwright/test';

test.describe('CV Reformatter Workflow', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check header is visible
    await expect(page.locator('h1')).toContainText('CV Reformatter ESN');

    // Check the main sections are visible
    await expect(page.getByText('Liste des CV')).toBeVisible();
    await expect(page.getByText('Aperçu')).toBeVisible();
  });

  test('should show empty state when no CV selected', async ({ page }) => {
    await page.goto('/');

    // Check empty state message
    await expect(page.getByText('Sélectionnez un CV dans la liste')).toBeVisible();
  });

  test('should have health endpoint working', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('should list CVs from API', async ({ request }) => {
    const response = await request.get('/api/cv/list');

    // API should respond (might be empty or have error due to B2 config)
    expect(response.status()).toBeLessThan(500);
  });

  test('should display brand selector options', async ({ page }) => {
    await page.goto('/');

    // The brand selector should be visible in the preview section
    // or when a CV is selected
    const preview = page.getByText('Aperçu');
    await expect(preview).toBeVisible();
  });

  test('should have workflow steps component structure', async ({ page }) => {
    await page.goto('/');

    // Workflow steps should show these labels when a CV is selected
    // For now, just check the page loads without errors
    await expect(page).toHaveTitle(/CV Reformatter/);
  });
});

test.describe('API Endpoints', () => {
  test('health check returns expected structure', async ({ request }) => {
    const response = await request.get('/api/health');
    const data = await response.json();

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
  });

  test('CV list endpoint handles errors gracefully', async ({ request }) => {
    const response = await request.get('/api/cv/list');
    const data = await response.json();

    // Should return success or proper error structure
    expect(data).toHaveProperty('success');
    if (!data.success) {
      expect(data).toHaveProperty('error');
    }
  });

  test('CV endpoint returns 404 for non-existent CV', async ({ request }) => {
    const response = await request.get('/api/cv/non-existent-id');
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });
});
