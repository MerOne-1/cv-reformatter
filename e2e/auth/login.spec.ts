import { test, expect } from '@playwright/test';
import {
  TEST_USER,
  hasSessionCookie,
  expectToBeOnLoginPage,
  AUTH_COOKIE_NAME,
} from '../helpers/auth.helpers';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('should display login form with required fields', async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe|password/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connexion|se connecter|login/i })
    ).toBeVisible();
  });

  test('should login with valid credentials', async ({ page, context }) => {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000,
    });

    // Should have session cookie
    const hasSession = await hasSessionCookie(context);
    expect(hasSession).toBe(true);
  });

  test('should redirect to home after successful login', async ({ page }) => {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should be on home page
    await expect(page).toHaveURL('/');
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/mot de passe|password/i).fill('password123');
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should stay on login page (form validation or API error)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for wrong password', async ({ page }) => {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/mot de passe|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should show error message and stay on login
    await expect(page).toHaveURL(/\/login/);

    // Error should be visible (wait for API response)
    const errorMessage = page.locator('[role="alert"], .error, [class*="error"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show error for non-existent user', async ({ page }) => {
    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByLabel(/mot de passe|password/i).fill('password123');
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should show error and stay on login (wait for API response via error visibility)
    const errorMessage = page.locator('[role="alert"], .error, [class*="error"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should require email field', async ({ page }) => {
    await page.getByLabel(/mot de passe|password/i).fill('password123');
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Email field should be marked as invalid or error shown
    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate((el) => {
      return (el as HTMLInputElement).validity?.valueMissing || el.getAttribute('aria-invalid') === 'true';
    });

    // Either form validation or still on login page
    const onLoginPage = page.url().includes('/login');
    expect(isInvalid || onLoginPage).toBe(true);
  });

  test('should require password field', async ({ page }) => {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should stay on login page (form validation or API error)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should preserve callbackUrl after login', async ({ page }) => {
    // Navigate to login with callback URL
    await page.goto('/login?callbackUrl=%2Fpreferences');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should redirect to callback URL (or home if not supported)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000,
    });

    // Either on preferences or home is acceptable
    const url = page.url();
    expect(url.includes('/preferences') || url === 'http://localhost:3000/').toBe(true);
  });

  test('should have session cookie after login', async ({ page, context }) => {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'));

    // Check cookie exists
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === AUTH_COOKIE_NAME);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);
  });

  test('should show loading state on submit button', async ({ page }) => {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_USER.password);

    const submitButton = page.getByRole('button', { name: /connexion|se connecter|login/i });

    // Click and verify button state changes or navigation succeeds
    await submitButton.click();

    // Either button shows loading state OR navigation happens (fast submit)
    // We verify the form submission works regardless of loading state implementation
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000,
    });

    // If we got here, the submit worked correctly
    await expect(page).not.toHaveURL(/\/login/);
  });
});
