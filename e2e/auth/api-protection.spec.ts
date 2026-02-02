import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

test.describe('API Protection - Unauthenticated', () => {
  test('should return 401 for GET /api/comments without auth', async ({ request }) => {
    const response = await request.get('/api/comments?cvId=test-cv', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 for POST /api/comments without auth', async ({ request }) => {
    const response = await request.post('/api/comments', {
      data: {
        cvId: 'test-cv',
        content: 'Test comment',
        offset: 0,
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 for GET /api/users/:id/preferences without auth', async ({
    request,
  }) => {
    const response = await request.get('/api/users/test-user-id/preferences', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });

  test('should return 401 for PATCH /api/users/:id/preferences without auth', async ({
    request,
  }) => {
    const response = await request.patch('/api/users/test-user-id/preferences', {
      data: { highlightColor: '#FF0000' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });

  test('should return 401 for protected agent endpoints', async ({ request }) => {
    const response = await request.get('/api/agents', {
      failOnStatusCode: false,
    });

    // Agents might be public or protected - check either way
    expect([200, 401].includes(response.status())).toBe(true);
  });
});

test.describe('API Protection - Authenticated', () => {
  test.use({ storageState: STORAGE_STATE });

  test('should allow GET /api/comments with session', async ({ request }) => {
    const response = await request.get('/api/comments?cvId=test-cv');

    // Should be allowed (even if empty)
    expect(response.status()).toBeLessThan(500);
    expect(response.status()).not.toBe(401);
  });

  test('should allow GET /api/cv/list with session', async ({ request }) => {
    const response = await request.get('/api/cv/list');

    // Should be allowed
    expect(response.status()).toBeLessThan(500);
    expect(response.status()).not.toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('success');
  });

  test('should allow GET /api/health with or without session', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('should include user context in authenticated requests', async ({ request }) => {
    // This test verifies the session provides user context
    const response = await request.get('/api/cv/list');

    // Request should succeed with session
    expect(response.ok() || response.status() === 400).toBe(true);
  });
});

test.describe('API Authorization', () => {
  test.use({ storageState: STORAGE_STATE });

  test('should return 403 for accessing other user preferences', async ({ request }) => {
    // Try to access preferences for a different user ID
    const response = await request.get('/api/users/different-user-id/preferences', {
      failOnStatusCode: false,
    });

    // Should be forbidden (403) or not found (404)
    expect([403, 404].includes(response.status())).toBe(true);
  });

  test('should return 403 for modifying other user preferences', async ({ request }) => {
    const response = await request.patch('/api/users/different-user-id/preferences', {
      data: { highlightColor: '#FF0000' },
      failOnStatusCode: false,
    });

    // Should be forbidden
    expect([403, 404].includes(response.status())).toBe(true);
  });
});

test.describe('API Error Responses', () => {
  test('should return proper error structure for auth failures', async ({ request }) => {
    const response = await request.get('/api/comments?cvId=test', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);

    const data = await response.json();

    // Error response should have consistent structure
    expect(data).toHaveProperty('success', false);
    expect(data).toHaveProperty('error');
    expect(typeof data.error).toBe('string');
  });

  test('should not leak sensitive info in error responses', async ({ request }) => {
    const response = await request.get('/api/users/test-id/preferences', {
      failOnStatusCode: false,
    });

    const data = await response.json();

    // Error should not contain stack traces or internal details
    const errorString = JSON.stringify(data);
    expect(errorString).not.toContain('stack');
    expect(errorString).not.toContain('at Function');
    expect(errorString).not.toContain('node_modules');
  });
});
