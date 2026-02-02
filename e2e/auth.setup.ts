import { test as setup, expect } from '@playwright/test';
import { TEST_USER, loginViaUI, hasSessionCookie } from './helpers/auth.helpers';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page, context }) => {
  // Navigate to login page
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);

  // Fill login form
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);

  // Submit and wait for redirect
  await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

  // Wait for successful authentication - should redirect away from login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  });

  // Verify session cookie is set
  const hasSession = await hasSessionCookie(context);
  expect(hasSession).toBe(true);

  // Wait for page to fully load
  await page.waitForLoadState('networkidle');

  // Save storage state
  await context.storageState({ path: authFile });
});
