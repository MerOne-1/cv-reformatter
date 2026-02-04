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
