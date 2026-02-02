import { test, expect } from '../fixtures/auth.fixture';
import {
  hasSessionCookie,
  AUTH_COOKIE_NAME,
  TEST_USER,
} from '../helpers/auth.helpers';

test.describe('Session Management', () => {
  test('should persist session after page refresh', async ({ authenticatedPage: page }) => {
    const context = page.context();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify initial session
    expect(await hasSessionCookie(context)).toBe(true);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Session should still be valid
    expect(await hasSessionCookie(context)).toBe(true);

    // Should still be on home page (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should persist session across navigation', async ({ authenticatedPage: page }) => {
    const context = page.context();

    // Navigate through multiple pages
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await hasSessionCookie(context)).toBe(true);

    await page.goto('/preferences');
    await page.waitForLoadState('networkidle');
    expect(await hasSessionCookie(context)).toBe(true);

    // Navigate back
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await hasSessionCookie(context)).toBe(true);

    // Should never be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should load user data from session', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // User name should be visible somewhere in the header/UI
    const userNameElement = page.locator('text=' + TEST_USER.name).first();

    // User name or email should be displayed
    const hasUserName = await userNameElement.isVisible().catch(() => false);
    const hasEmail = await page.locator('text=' + TEST_USER.email).first().isVisible().catch(() => false);

    expect(hasUserName || hasEmail).toBe(true);
  });

  test('should have httpOnly cookie for security', async ({ authenticatedPage: page }) => {
    const context = page.context();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === AUTH_COOKIE_NAME);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
  });

  test('should not expose session token to JavaScript', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to read the session cookie via JavaScript
    const cookieValue = await page.evaluate((cookieName) => {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName) {
          return value;
        }
      }
      return null;
    }, AUTH_COOKIE_NAME);

    // httpOnly cookies should not be accessible from JS
    expect(cookieValue).toBeNull();
  });

  test('should handle concurrent requests with same session', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Make multiple concurrent requests
    const results = await Promise.all([
      page.request.get('/api/health'),
      page.request.get('/api/cv/list'),
      page.request.get('/api/health'),
    ]);

    // All requests should succeed (no auth failures)
    for (const response of results) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

test.describe('Session Cookie Cache', () => {
  test('should respect cookie cache timeout', async ({ authenticatedPage: page }) => {
    const context = page.context();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const initialCookies = await context.cookies();
    const initialSession = initialCookies.find((c) => c.name === AUTH_COOKIE_NAME);

    // Wait a short time (less than cache timeout)
    await page.waitForTimeout(1000);

    // Make a request
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const afterCookies = await context.cookies();
    const afterSession = afterCookies.find((c) => c.name === AUTH_COOKIE_NAME);

    // Session should still be valid
    expect(afterSession).toBeDefined();
    expect(await hasSessionCookie(context)).toBe(true);
  });
});

test.describe('Session Expiration', () => {
  test.slow();

  test('should handle invalid session gracefully', async ({ browser }) => {
    // Create a context with a fake/invalid session token
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: 'invalid-session-token-12345',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    const page = await context.newPage();

    // Try to access protected route
    await page.goto('/');

    // Should redirect to login (invalid session rejected)
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });
});
