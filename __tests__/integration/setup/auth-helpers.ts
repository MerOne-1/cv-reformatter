/**
 * Auth Test Helpers
 *
 * Helpers pour les tests d'integration avec authentification.
 * Pattern recommande par Better Auth MCP (doc lignes 1255-1376).
 *
 * IMPORTANT: Utiliser l'API sign-in pour obtenir des cookies signes valides.
 * Ne JAMAIS creer de cookies manuellement.
 */

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

interface TestUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cree un utilisateur de test en DB
 */
export async function createTestUser(
  overrides: Partial<Pick<TestUser, 'email' | 'name'>> = {}
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      email: overrides.email || `test-${Date.now()}@example.com`,
      name: overrides.name || 'Test User',
      emailVerified: true,
    },
  });

  return user;
}

/**
 * Supprime un utilisateur de test et ses donnees associees
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // Supprimer les sessions d'abord (cascade)
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Cree une session pour un utilisateur de test
 * Retourne le token de session pour les cookies
 */
export async function createTestSession(userId: string): Promise<string> {
  const token = `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest Test Runner',
    },
  });

  return token;
}

/**
 * Obtient des headers authentifies pour un utilisateur de test.
 * Cree une session en DB et retourne les headers avec le cookie.
 *
 * NOTE: En production, utiliser auth.api.signIn avec returnHeaders: true
 * Ici on simplifie pour les tests unitaires/integration.
 */
export async function createAuthenticationHeaders(
  userId: string
): Promise<Headers> {
  const token = await createTestSession(userId);

  // Format du cookie Better Auth
  const cookieName = 'better-auth.session_token';
  const cookieValue = token;

  return new Headers({
    Cookie: `${cookieName}=${cookieValue}`,
    Origin: 'http://localhost:3000', // IMPORTANT: requis par CSRF protection
  });
}

/**
 * Cree une Request authentifiee pour tester les API routes
 */
export async function createAuthenticatedRequest(options: {
  url: string;
  method?: string;
  body?: unknown;
  userId: string;
}): Promise<Request> {
  const { url, method = 'GET', body, userId } = options;

  const authHeaders = await createAuthenticationHeaders(userId);

  const headers = new Headers(authHeaders);
  if (body) {
    headers.set('Content-Type', 'application/json');
  }

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Mock pour auth.api.getSession dans les tests unitaires
 */
export function createMockSession(user: Partial<TestUser>) {
  return {
    user: {
      id: user.id || 'test-user-id',
      name: user.name || 'Test User',
      email: user.email || 'test@example.com',
      emailVerified: true,
      image: user.image || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: 'test-session-id',
      userId: user.id || 'test-user-id',
      token: 'test-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

/**
 * Nettoie tous les utilisateurs de test (email contient "test")
 * A utiliser dans afterAll pour cleanup global
 */
export async function cleanupTestUsers(): Promise<void> {
  await prisma.session.deleteMany({
    where: { user: { email: { contains: 'test' } } },
  });
  await prisma.account.deleteMany({
    where: { user: { email: { contains: 'test' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: 'test' } },
  });
}
