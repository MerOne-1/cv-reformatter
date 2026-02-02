import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { TEST_USER, loginViaUI, logout, isAuthenticated } from '../helpers/auth.helpers';
import { STORAGE_STATE } from '../../playwright.config';

type TestUser = {
  email: string;
  password: string;
  name: string;
};

type AuthFixtures = {
  testUser: TestUser;
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
  freshPage: Page;
  freshContext: BrowserContext;
};

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use(TEST_USER);
  },

  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
  },

  freshContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  freshPage: async ({ freshContext }, use) => {
    const page = await freshContext.newPage();
    await use(page);
  },
});

export { expect, TEST_USER, loginViaUI, logout, isAuthenticated };
export type { TestUser, AuthFixtures };
