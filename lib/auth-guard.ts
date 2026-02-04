import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Recupere l'utilisateur authentifie (Server Component / Server Action / API Route)
 */
export async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  return session.user;
}

/**
 * Recupere la session complete (user + session metadata)
 */
export async function getAuthenticatedSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
}

/**
 * Exige une authentification - throw si non authentifie
 * Utile pour les Server Actions
 */
export async function requireAuth() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

/**
 * Verifie si la session est "fresh" (recente)
 * Utile pour les actions sensibles (changement mot de passe, suppression compte, etc.)
 *
 * @param maxAgeMs - Age maximum de la session en millisecondes (defaut: 5 minutes)
 * @throws Error si la session n'est pas fresh
 */
export async function requireFreshSession(maxAgeMs: number = 5 * 60 * 1000) {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: {
      disableCookieCache: true, // Force DB check pour avoir l'heure exacte
    },
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Verifier freshness basee sur la creation de la session
  const sessionAge = Date.now() - new Date(session.session.createdAt).getTime();

  if (sessionAge > maxAgeMs) {
    throw new Error("Session expired for sensitive action. Please re-authenticate.");
  }

  return session.user;
}
