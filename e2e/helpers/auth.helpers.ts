import { Page, BrowserContext, APIRequestContext, expect } from '@playwright/test';

export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'test@example.com',
  password: process.env.E2E_TEST_PASSWORD || 'testpassword123',
  name: process.env.E2E_TEST_NAME || 'Test User',
} as const;

export const AUTH_COOKIE_NAME = 'better-auth.session_token';

export async function loginViaUI(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).fill(password);
  await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10000,
  });
}

export async function loginViaAPI(
  request: APIRequestContext,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<{ sessionToken: string }> {
  const response = await request.post('/api/auth/sign-in/email', {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const cookies = response.headers()['set-cookie'];
  const sessionToken = extractSessionToken(cookies);

  if (!sessionToken) {
    throw new Error('No session token in response');
  }

  return { sessionToken };
}

export async function logout(page: Page): Promise<void> {
  // Find and click the logout button in header
  const logoutButton = page.getByRole('button', { name: /déconnexion|logout|déconnecter/i });

  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL(/\/login/);
    return;
  }

  // Try menu-based logout
  const userMenu = page.locator('[data-testid="user-menu"], [aria-label="User menu"]');
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.getByRole('menuitem', { name: /déconnexion|logout/i }).click();
    await page.waitForURL(/\/login/);
    return;
  }

  throw new Error('Could not find logout button or user menu');
}

export async function getSessionCookie(
  context: BrowserContext
): Promise<string | null> {
  const cookies = await context.cookies();
  const sessionCookie = cookies.find((c) => c.name === AUTH_COOKIE_NAME);
  return sessionCookie?.value ?? null;
}

export async function hasSessionCookie(context: BrowserContext): Promise<boolean> {
  const token = await getSessionCookie(context);
  return token !== null && token.length > 0;
}

export async function clearAuthState(context: BrowserContext): Promise<void> {
  await context.clearCookies();

  // Clear localStorage and sessionStorage via page if available
  const pages = context.pages();
  for (const page of pages) {
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch {
      // Page might not be available
    }
  }
}

export async function waitForAuthRedirect(
  page: Page,
  expectedPath: string = '/login'
): Promise<void> {
  await page.waitForURL((url) => url.pathname.includes(expectedPath), {
    timeout: 10000,
  });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  const context = page.context();
  return hasSessionCookie(context);
}

export async function expectToBeOnLoginPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /connexion|se connecter|login/i })).toBeVisible();
}

export async function expectToBeAuthenticated(page: Page): Promise<void> {
  const hasSession = await isAuthenticated(page);
  expect(hasSession).toBe(true);
}

export async function expectCallbackUrlPreserved(
  page: Page,
  originalPath: string
): Promise<void> {
  const url = new URL(page.url());
  const callbackUrl = url.searchParams.get('callbackUrl');
  expect(callbackUrl).toContain(originalPath);
}

export function extractSessionToken(setCookieHeader: string | undefined): string | null {
  if (!setCookieHeader) return null;

  // Use regex to extract the session token - handles commas in Expires dates
  const match = setCookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export async function waitForSessionEstablished(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await expect(async () => {
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
  }).toPass({ timeout });
}
