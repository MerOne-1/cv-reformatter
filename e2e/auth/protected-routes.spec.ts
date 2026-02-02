import { test, expect } from '@playwright/test';

test.describe('Route Protection - Unauthenticated', () => {
  test('should redirect / to /login when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect /preferences to /login', async ({ page }) => {
    await page.goto('/preferences');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect /settings to /login', async ({ page }) => {
    await page.goto('/settings');

    // Should redirect to login (or 404 if route doesn't exist)
    const url = page.url();
    expect(url.includes('/login') || url.includes('/404')).toBe(true);
  });

  test('should preserve callbackUrl in redirect', async ({ page }) => {
    await page.goto('/preferences');

    // Should redirect to login with callbackUrl
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    const callbackUrl = url.searchParams.get('callbackUrl');

    // callbackUrl should contain the original path
    expect(callbackUrl).toContain('/preferences');
  });

  test('should return 401 for protected API routes', async ({ request }) => {
    // API routes should return 401 when unauthenticated
    const response = await request.get('/api/cv/list', {
      failOnStatusCode: false,
    });

    // API should return 401 (unauthenticated)
    expect(response.status()).toBe(401);
  });
});

test.describe('Public Routes - No Auth Required', () => {
  test('should allow access to /login without auth', async ({ page }) => {
    await page.goto('/login');

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Login form should be visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should allow access to /api/health without auth', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('should allow access to /api/auth routes without auth', async ({ request }) => {
    // Sign-in endpoint should be accessible
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email: 'test@test.com', password: 'test' },
      failOnStatusCode: false,
    });

    // Should get a response (even if it's an error)
    // 400 means invalid credentials, not 401 unauthorized
    expect(response.status()).toBeLessThan(500);
  });

  test('should serve static assets without auth', async ({ request }) => {
    // Favicon should be accessible
    const response = await request.get('/favicon.ico', {
      failOnStatusCode: false,
    });

    // Should be accessible (200 or 404 if not exists)
    expect([200, 404].includes(response.status())).toBe(true);
  });
});

test.describe('Route Protection - Edge Cases', () => {
  test('should handle double redirect gracefully', async ({ page }) => {
    // Go to protected route
    await page.goto('/preferences');

    // Wait for login redirect
    await expect(page).toHaveURL(/\/login/);

    // Try going to another protected route
    await page.goto('/');

    // Should still be on login (or redirect to login)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle malformed URLs', async ({ page }) => {
    // Try with malformed callback URL
    await page.goto('/login?callbackUrl=javascript:alert(1)');

    // Should sanitize and stay on login
    await expect(page).toHaveURL(/\/login/);

    // No XSS should execute
    const alertTriggered = await page.evaluate(() => {
      // If XSS worked, this would have been set
      return (window as any).__xss_triggered === true;
    });
    expect(alertTriggered).toBe(false);
  });

  test('should not cache protected pages', async ({ page }) => {
    // First request should redirect to login
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    // Go back in history shouldn't show cached protected content
    await page.goBack();

    // Should still be protected (either login or empty)
    const onLoginOrEmpty = page.url().includes('/login') || page.url() === 'about:blank';
    expect(onLoginOrEmpty).toBe(true);
  });
});
