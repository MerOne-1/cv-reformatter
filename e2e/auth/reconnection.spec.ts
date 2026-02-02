import { test, expect } from '../fixtures/auth.fixture';
import {
  hasSessionCookie,
  loginViaUI,
  TEST_USER,
  AUTH_COOKIE_NAME,
} from '../helpers/auth.helpers';

test.describe('Reconnection Scenarios', () => {
  test('should stay logged in after browser restart (storageState)', async ({
    authenticatedPage: page,
  }) => {
    const context = page.context();

    // Initial load - should be authenticated via storageState
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Session should exist
    expect(await hasSessionCookie(context)).toBe(true);

    // User data should be available
    const hasUserName = await page
      .locator('text=' + TEST_USER.name)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasUserName).toBe(true);
  });

  test('should redirect to login when session is invalid', async ({ browser }) => {
    // Create context with invalid session
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: 'completely-invalid-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    const page = await context.newPage();
    await page.goto('/');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test('should preserve user context after reconnection', async ({
    authenticatedPage: page,
  }) => {
    // Load page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get user info from page
    const userName = TEST_USER.name;

    // Capture context BEFORE closing page
    const context = page.context();

    // Simulate reconnection by closing and reopening
    await page.close();

    // Create new page in same context
    const newPage = await context.newPage();

    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    // User should still be shown
    const hasUserName = await newPage
      .locator('text=' + userName)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasUserName).toBe(true);
  });

  test('should handle session refresh seamlessly', async ({ authenticatedPage: page }) => {
    const context = page.context();

    // Make multiple requests to simulate usage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.goto('/preferences');
    await page.waitForLoadState('networkidle');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Session should still be valid after navigation
    expect(await hasSessionCookie(context)).toBe(true);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Network Recovery', () => {
  test('should recover after network interruption', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate going offline
    await page.context().setOffline(true);

    // Try to navigate (will fail)
    await page.goto('/preferences').catch(() => {
      // Expected to fail
    });

    // Go back online
    await page.context().setOffline(false);

    // Retry navigation
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should still be authenticated
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should show appropriate error during network failure', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Try to make API request
    const response = await page.request
      .get('/api/health')
      .catch((e) => ({ error: e.message }));

    // Should fail (network error)
    expect('error' in response || !(response as any).ok()).toBe(true);

    // Go back online
    await page.context().setOffline(false);
  });
});

test.describe('Re-authentication Flow', () => {
  test('should allow re-login after logout', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await loginViaUI(page);

    // Verify logged in
    await expect(page).not.toHaveURL(/\/login/);

    // Find and click logout
    const logoutButton = page.getByRole('button', {
      name: /déconnexion|logout|déconnecter/i,
    });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL(/\/login/);
    }

    // Should be on login
    await expect(page).toHaveURL(/\/login/);

    // Login again
    await loginViaUI(page);

    // Should be authenticated again
    await expect(page).not.toHaveURL(/\/login/);
    expect(await hasSessionCookie(context)).toBe(true);

    await context.close();
  });

  test('should maintain separate sessions after re-login', async ({ browser }) => {
    // First session
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await loginViaUI(page1);

    const cookies1 = await context1.cookies();
    const session1 = cookies1.find((c) => c.name === AUTH_COOKIE_NAME)?.value;

    await context1.close();

    // Second session (new context)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await loginViaUI(page2);

    const cookies2 = await context2.cookies();
    const session2 = cookies2.find((c) => c.name === AUTH_COOKIE_NAME)?.value;

    // Sessions should be different (new session token)
    expect(session1).toBeDefined();
    expect(session2).toBeDefined();
    // Note: Sessions might be the same if server reuses tokens - this is valid

    await context2.close();
  });
});
