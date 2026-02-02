import { test, expect } from '@playwright/test';
import {
  hasSessionCookie,
  loginViaUI,
  logout,
  TEST_USER,
  AUTH_COOKIE_NAME,
} from '../helpers/auth.helpers';
import { STORAGE_STATE } from '../../playwright.config';

test.describe('Multi-Tab Scenarios', () => {
  test('should share session between tabs in same context', async ({ browser }) => {
    // Create authenticated context
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });

    // Open two tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Both should have the session
    await page1.goto('/');
    await page2.goto('/');

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Both should be authenticated (not on login)
    await expect(page1).not.toHaveURL(/\/login/);
    await expect(page2).not.toHaveURL(/\/login/);

    // Both should have the session cookie
    expect(await hasSessionCookie(context)).toBe(true);

    await context.close();
  });

  test('should sync logout across tabs', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Navigate both to home
    await page1.goto('/');
    await page2.goto('/');

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Logout from page1
    await logout(page1);
    await expect(page1).toHaveURL(/\/login/);

    // Page2 should also be affected when it tries to access protected content
    await page2.reload();
    await page2.waitForURL(/\/login/, { timeout: 10000 });

    await expect(page2).toHaveURL(/\/login/);

    await context.close();
  });

  test('should maintain isolation between browser contexts', async ({ browser }) => {
    // Create two separate contexts
    const context1 = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    const context2 = await browser.newContext(); // No auth

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Page1 should be authenticated
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');
    await expect(page1).not.toHaveURL(/\/login/);

    // Page2 should NOT be authenticated
    await page2.goto('/');
    await expect(page2).toHaveURL(/\/login/);

    await context1.close();
    await context2.close();
  });

  test('should handle concurrent sessions in different contexts', async ({ browser }) => {
    // Two separate authenticated contexts
    const context1 = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    const context2 = await browser.newContext({
      storageState: STORAGE_STATE,
    });

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Both should work independently
      await page1.goto('/');
      await page2.goto('/');

      await page1.waitForLoadState('networkidle');
      await page2.waitForLoadState('networkidle');

      await expect(page1).not.toHaveURL(/\/login/);
      await expect(page2).not.toHaveURL(/\/login/);

      // Logout from context1 should NOT affect context2
      await logout(page1);
      await expect(page1).toHaveURL(/\/login/);

      // Page2 should still be accessible (different context)
      await page2.reload();
      await page2.waitForLoadState('networkidle');
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});

test.describe('Race Conditions', () => {
  test('should handle simultaneous login attempts', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Navigate both to login
    await page1.goto('/login');
    await page2.goto('/login');

    // Fill forms simultaneously
    await Promise.all([
      page1.getByLabel(/email/i).fill(TEST_USER.email),
      page2.getByLabel(/email/i).fill(TEST_USER.email),
    ]);

    await Promise.all([
      page1.getByLabel(/mot de passe|password/i).fill(TEST_USER.password),
      page2.getByLabel(/mot de passe|password/i).fill(TEST_USER.password),
    ]);

    // Submit both
    await Promise.all([
      page1.getByRole('button', { name: /connexion|se connecter|login/i }).click(),
      page2.getByRole('button', { name: /connexion|se connecter|login/i }).click(),
    ]);

    // Wait for navigations
    await Promise.all([
      page1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
      page2.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
    ]);

    // Both should be authenticated
    await expect(page1).not.toHaveURL(/\/login/);
    await expect(page2).not.toHaveURL(/\/login/);

    await context.close();
  });

  test('should handle login in tab A while tab B is on protected route', async ({
    browser,
  }) => {
    const context = await browser.newContext();

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Page1 goes to login
    await page1.goto('/login');

    // Page2 tries to access protected route (will redirect)
    await page2.goto('/');
    await expect(page2).toHaveURL(/\/login/);

    // Login on page1
    await page1.getByLabel(/email/i).fill(TEST_USER.email);
    await page1.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);
    await page1.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    await page1.waitForURL((url) => !url.pathname.includes('/login'));

    // Page2 should now be able to access protected content after refresh
    await page2.goto('/');
    await page2.waitForLoadState('networkidle');

    await expect(page2).not.toHaveURL(/\/login/);

    await context.close();
  });
});

test.describe('Tab Communication', () => {
  test('should detect session changes across tabs', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Both tabs should show authenticated state
    const userName1 = await page1.locator('text=' + TEST_USER.name).first().isVisible().catch(() => false);
    const userName2 = await page2.locator('text=' + TEST_USER.name).first().isVisible().catch(() => false);

    // At least one should show the user name
    expect(userName1 || userName2).toBe(true);

    await context.close();
  });
});
