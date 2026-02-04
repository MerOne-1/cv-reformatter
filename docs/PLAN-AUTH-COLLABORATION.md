# Plan d'Integration - Better Auth & Collaboration

## Objectif

Integrer une authentification robuste avec Better Auth (Google OAuth) et preparer l'infrastructure pour le travail collaboratif en temps reel avec Lexical + Y.js.

> **Sources**: Ce document est enrichi avec les informations officielles obtenues via le MCP Better Auth (documentation, discussions GitHub, best practices).

---

## Table des matieres

1. [Phase 1: Integration Better Auth](#phase-1-integration-better-auth-avec-google-oauth)
2. [Phase 2: Migration Lexical + Y.js](#phase-2-migration-vers-ledition-collaborative)
3. [Phase 3: Modele collaboratif](#phase-3-modele-de-donnees-collaboratif)
4. [Reference: Patterns Better Auth](#reference-patterns-better-auth-mcp)
5. [Strategie de Tests](#strategie-de-tests)
6. [Checklist d'implementation](#phase-4-checklist-dimplementation)

---

## Phase 1: Integration Better Auth avec Google OAuth

### 1.1 Installation des dependances

```bash
pnpm add better-auth
pnpm add -D @better-auth/cli
```

### 1.2 Configuration des variables d'environnement

Ajouter dans `.env`:

```env
# Better Auth
BETTER_AUTH_SECRET=<generer avec: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=<votre_client_id>
GOOGLE_CLIENT_SECRET=<votre_client_secret>

# Email (optionnel, pour verification email)
RESEND_API_KEY=<votre_api_key>
```

### 1.3 Configuration Google Cloud Console

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Creer un nouveau projet ou selectionner un existant
3. Activer **Google+ API** et **Google Identity**
4. Aller dans **APIs & Services > Credentials**
5. Creer **OAuth 2.0 Client ID** (type: Web Application)
6. Configurer les **Authorized redirect URIs**:
   - Dev: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://votre-domaine.com/api/auth/callback/google`

> **MCP Better Auth**: Le format exact du callback est `/api/auth/callback/{provider}`.

### 1.4 Generation du Schema Prisma

Better Auth peut generer automatiquement le schema Prisma:

```bash
# Generer le schema Prisma depuis la config Better Auth
pnpm dlx @better-auth/cli@latest generate
```

Le CLI va generer les modeles suivants dans `prisma/schema.prisma`:

```prisma
// ==========================================
// BETTER AUTH MODELS (genere automatiquement)
// ==========================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations Better Auth
  sessions      Session[]
  accounts      Account[]

  // Relations metier (a ajouter manuellement)
  cvs           CV[]
  improvements  Improvement[]
  audioNotes    AudioNote[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?   @db.Text
  refreshToken          String?   @db.Text
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?   @db.Text
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([providerId, accountId])
  @@index([userId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

// Table pour le rate limiting (optionnel mais recommande)
model RateLimit {
  id         String   @id @default(cuid())
  key        String   @unique
  count      Int
  lastReset  DateTime
}
```

### 1.5 Mise a jour des modeles existants

Ajouter `userId` aux modeles CV, Improvement, AudioNote:

```prisma
model CV {
  // ... champs existants ...

  // Nouveau: proprietaire du CV
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
}

model Improvement {
  // ... champs existants ...

  // Nouveau: auteur de l'amelioration
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
}

model AudioNote {
  // ... champs existants ...

  // Nouveau: auteur de la note audio
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
}
```

### 1.6 Configuration Better Auth - Serveur

Creer `lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // ==========================================
  // PROVIDERS
  // ==========================================
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Forcer refresh token (important pour acces API Google)
      accessType: "offline",
      prompt: "select_account consent",
    },
  },

  // ==========================================
  // SESSIONS
  // ==========================================
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 jours
    updateAge: 60 * 60 * 24, // Refresh chaque jour
    freshAge: 60 * 5, // Session "fresh" pendant 5 min (pour actions sensibles)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache cookie 5 min (reduit DB calls)
    },
  },

  // ==========================================
  // RATE LIMITING (anti brute-force)
  // ==========================================
  rateLimit: {
    enabled: true,
    window: 60, // 60 secondes
    max: 100, // 100 requetes max
    storage: "database", // Persiste en DB (recommande pour prod)
    customRules: {
      // Regles strictes pour endpoints sensibles
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-in/social": { window: 10, max: 5 },
      "/sign-up/*": { window: 60, max: 5 },
      "/forgot-password/*": { window: 60, max: 3 },
    },
  },

  // ==========================================
  // EMAIL VERIFICATION (optionnel)
  // ==========================================
  emailVerification: {
    sendOnSignUp: false, // Desactive car on utilise Google OAuth
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 heure
    sendVerificationEmail: async ({ user, url, token }) => {
      // Implementer avec Resend/SendGrid si necessaire
      console.log(`Verification email for ${user.email}: ${url}`);
    },
  },

  // ==========================================
  // ACCOUNT LINKING
  // ==========================================
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
      allowDifferentEmails: false,
    },
  },

  // ==========================================
  // ADVANCED
  // ==========================================
  advanced: {
    ipAddress: {
      // Headers pour detecter l'IP reelle (Cloudflare, Vercel, etc.)
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },

  // ==========================================
  // HOOKS (lifecycle callbacks)
  // ==========================================
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // onUserCreated - initialiser donnees utilisateur
          console.log(`New user created: ${user.email}`);
          // Exemple: creer preferences par defaut, envoyer welcome email, etc.
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // onSessionCreated
          console.log(`New session for user: ${session.userId}`);
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          // Specifique OAuth - detecter nouvelles inscriptions
          if (account.providerId !== "credential") {
            console.log(`OAuth account linked: ${account.providerId}`);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
```

### 1.7 Route API Better Auth

Creer `app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### 1.8 Client Auth

Creer `lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

// Hooks et methodes exportes
export const {
  useSession,
  signIn,
  signOut,
  getSession,
} = authClient;
```

### 1.9 Middleware de protection des routes

Creer `middleware.ts` a la racine:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Routes publiques (pas besoin d'auth)
const publicRoutes = ["/login", "/api/auth", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes publiques - bypass
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Assets statiques - bypass
  if (pathname.match(/\.(ico|png|jpg|svg|css|js)$/)) {
    return NextResponse.next();
  }

  // Check optimiste via cookie (rapide, sans DB)
  // NOTE: Ce n'est PAS securise pour des donnees sensibles
  // La vraie validation se fait dans chaque page/route
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    // Rediriger vers login avec callback URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

> **MCP Better Auth**: Le middleware doit etre "optimiste" (check cookie seulement). La vraie validation doit se faire dans chaque page/route avec `auth.api.getSession()`.

### 1.10 Page de connexion

Creer `app/login/page.tsx`:

```typescript
"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      });
    } catch (err) {
      console.error("Erreur de connexion:", err);
      setError("Erreur lors de la connexion. Veuillez reessayer.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CV Reformatter</CardTitle>
          <p className="text-muted-foreground">
            Connectez-vous pour acceder a vos CVs
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <span>Connexion en cours...</span>
            ) : (
              <>
                <GoogleIcon className="mr-2 h-5 w-5" />
                Continuer avec Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
```

### 1.11 Hook useCurrentUser

Creer `lib/hooks/use-current-user.ts`:

```typescript
import { authClient } from "@/lib/auth-client";

export function useCurrentUser() {
  const { data: session, isPending, error } = authClient.useSession();

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    error,
  };
}
```

### 1.12 Helpers pour routes API et Server Components

Creer `lib/auth-guard.ts`:

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Recupere l'utilisateur authentifie (Server Component / Server Action / API Route)
 *
 * @example
 * // Dans un Server Component
 * const user = await getAuthenticatedUser();
 * if (!user) redirect("/login");
 *
 * @example
 * // Dans une API Route
 * export async function GET() {
 *   const user = await getAuthenticatedUser();
 *   if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
 * }
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
 * Utile pour les actions sensibles (changement mot de passe, etc.)
 */
export async function requireFreshSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: {
      disableCookieCache: true, // Force DB check
    },
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Verifier freshness (configurable dans auth.ts)
  const sessionAge = Date.now() - new Date(session.session.createdAt).getTime();
  const freshAge = 5 * 60 * 1000; // 5 minutes

  if (sessionAge > freshAge) {
    throw new Error("Session expired for sensitive action");
  }

  return session.user;
}
```

### 1.13 Composant UserMenu

Creer `components/features/auth/user-menu.tsx`:

```typescript
"use client";

import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, User } from "lucide-react";

export function UserMenu() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || undefined} alt={user.name || ""} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Profil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Parametres
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Deconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Reference: Patterns Better Auth (MCP)

Cette section contient les patterns officiels recommandes par Better Auth, obtenus via le MCP.

### Recuperation utilisateur par contexte

| Contexte | Methode | Notes |
|----------|---------|-------|
| **Server Component** | `auth.api.getSession({ headers: await headers() })` | Validation complete avec DB |
| **Server Action** | `auth.api.getSession({ headers: await headers() })` | Idem |
| **API Route** | `auth.api.getSession({ headers: req.headers })` | Idem |
| **Middleware** | `getSessionCookie(request)` | Optimiste seulement (pas de DB) |
| **Client Component** | `authClient.useSession()` | Hook reactif |

### Hooks et Callbacks disponibles

#### Request Hooks (`hooks.before` / `hooks.after`)

```typescript
import { createAuthMiddleware } from "better-auth/api";

export const auth = betterAuth({
  hooks: {
    // Avant chaque requete auth
    before: createAuthMiddleware(async (ctx) => {
      // Validation custom, logging, etc.
    }),

    // Apres chaque requete auth
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          // Code post-inscription: onboarding, welcome email, etc.
          await sendWelcomeEmail(newSession.user.email);
        }
      }
    }),
  },
});
```

#### Database Hooks

```typescript
databaseHooks: {
  user: {
    create: {
      before: async (user) => {
        // Modifier avant creation
        return { data: { ...user, customField: "value" } };
      },
      after: async (user) => {
        // onUserCreated
      },
    },
    update: {
      before: async (userData) => { /* ... */ },
      after: async (user) => { /* ... */ },
    },
  },
  session: { /* create, update hooks */ },
  account: {
    create: {
      after: async (account) => {
        // Detecter OAuth registration
        if (account.providerId !== "credential") {
          // Logique specifique OAuth
        }
      },
    },
  },
  verification: { /* ... */ },
}
```

### Session Management

```typescript
// Deconnexion simple
await authClient.signOut();

// Revoquer une session specifique
await authClient.revokeSession({ token: "session-token" });

// Deconnexion de tous les autres appareils
await authClient.revokeOtherSessions();

// Deconnexion totale (tous les appareils)
await authClient.revokeSessions();

// Lors du changement de mot de passe
await authClient.changePassword({
  currentPassword,
  newPassword,
  revokeOtherSessions: true, // Deconnecte partout sauf session actuelle
});

// Lister les sessions actives (pour UI "appareils connectes")
const sessions = await authClient.listSessions();
```

### Account Linking (Email <-> OAuth)

```typescript
// Config
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ["google", "github", "email-password"],
    allowDifferentEmails: false,
    updateUserInfoOnLink: true, // MAJ avatar/name depuis OAuth
  },
}

// Lier Google a un compte email/password existant (client)
await authClient.linkSocial({
  provider: "google",
  callbackURL: "/dashboard",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"], // Optionnel
});

// Ajouter email/password a un compte Google existant (serveur uniquement)
await auth.api.setPassword({
  body: { newPassword: "..." },
  headers: await headers(),
});
```

### Rate Limiting

```typescript
rateLimit: {
  enabled: true,
  window: 60,
  max: 100,
  storage: "database", // ou "memory", "secondary-storage", custom

  customRules: {
    "/sign-in/email": { window: 10, max: 3 },
    "/two-factor/*": { window: 10, max: 3 },
    "/get-session": false, // Desactiver pour cet endpoint
  },
},

advanced: {
  ipAddress: {
    ipAddressHeaders: ["cf-connecting-ip"], // Cloudflare
  },
},
```

**Gestion 429 cote client:**

```typescript
authClient.signIn.email({
  email,
  password,
  fetchOptions: {
    onError: (ctx) => {
      if (ctx.response.status === 429) {
        const retryAfter = ctx.response.headers.get("X-Retry-After");
        toast.error(`Trop de tentatives. Reessayez dans ${retryAfter}s`);
      }
    },
  },
});
```

### Email Verification

```typescript
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  expiresIn: 3600, // 1 heure

  sendVerificationEmail: async ({ user, url, token }) => {
    // Ne pas await pour eviter timing attacks
    void sendEmail({
      to: user.email,
      subject: "Verifiez votre email",
      text: `Cliquez ici : ${url}`,
    });
  },

  afterEmailVerification: async (user) => {
    // Post-verification: debloquer features, etc.
    console.log(`${user.email} verifie!`);
  },
},

emailAndPassword: {
  requireEmailVerification: true, // Bloquer login si non verifie
},
```

**Client:**

```typescript
// Envoyer manuellement
await authClient.sendVerificationEmail({
  email: "user@email.com",
  callbackURL: "/verified",
});

// Verifier avec token
await authClient.verifyEmail({
  query: { token: "..." },
});
```

### Password Reset

**Via email link:**

```typescript
emailAndPassword: {
  sendResetPassword: async ({ user, url }) => {
    void sendEmail({
      to: user.email,
      subject: "Reinitialiser votre mot de passe",
      text: `Cliquez ici : ${url}`,
    });
  },
}
```

**Via OTP (plugin emailOTP):**

```typescript
// Envoyer OTP
await authClient.forgetPassword.emailOtp({ email });

// Reset avec OTP
await authClient.emailOtp.resetPassword({
  email,
  otp: "123456",
  password: "newPassword",
});
```

### RBAC avec Organization Plugin

```typescript
import { createAccessControl } from "better-auth/plugins";

// Definir permissions sur "document"
const ac = createAccessControl({
  document: ["create", "read", "comment", "update", "delete", "share"],
});

// Creer les roles
const owner = ac.newRole({
  document: ["create", "read", "comment", "update", "delete", "share"],
});
const editor = ac.newRole({
  document: ["read", "comment", "update"],
});
const commenter = ac.newRole({
  document: ["read", "comment"],
});
const viewer = ac.newRole({
  document: ["read"],
});

// Verifier permission (server)
const canEdit = await auth.api.hasPermission({
  userId,
  permission: "document:update",
});

// Verifier permission (client)
const canEdit = await authClient.organization.hasPermission({
  permission: "document:update",
});
```

---

## Strategie de Tests

> **Sources MCP Better Auth**: Cette section est basee sur les patterns documentes dans les issues GitHub #5609, #4940, #2299, et la documentation officielle de Better Auth.

### Vue d'ensemble

| Type de test | Objectif | Outils | Pattern principal |
|--------------|----------|--------|-------------------|
| **Unitaire** | Tester composants/fonctions isolement | Vitest/Jest | Mock `authClient` |
| **Integration** | Tester API routes avec auth | Vitest + Supertest | Login API + cookies |
| **E2E** | Tester flux utilisateur complet | Playwright | Injection cookies programmatique |

### Principes cles (MCP Better Auth)

1. **Ne jamais creer de cookies manuellement** - Les cookies Better Auth sont signes et encodes. Utiliser l'API de sign-in avec `returnHeaders: true`.
2. **Gerer les headers Origin/CSRF** - Better Auth valide l'origine quand des cookies sont presents.
3. **Isolation des tests** - Chaque test doit avoir son propre utilisateur pour permettre la parallelisation.
4. **Eviter le login UI** - Le login programmatique est 50-100x plus rapide.

---

### 1. Tests Unitaires (Vitest/Jest)

#### 1.1 Structure des fichiers

```
__tests__/
├── unit/
│   ├── components/
│   │   └── login-form.test.tsx
│   ├── hooks/
│   │   └── use-current-user.test.ts
│   └── lib/
│       └── auth-guard.test.ts
```

#### 1.2 Mock du client auth (CRITIQUE)

> **Important**: Le mock DOIT etre declare AVANT tout import qui utilise `authClient`.

```typescript
// __tests__/unit/components/login-form.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 1. DECLARER LE MOCK EN PREMIER
const mockSignInSocial = vi.fn();
const mockSignInEmail = vi.fn();
const mockUseSession = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: mockSignInSocial,
      email: mockSignInEmail,
    },
    useSession: mockUseSession,
    signOut: vi.fn(),
  },
}));

// 2. PUIS importer les composants
import LoginForm from "@/app/login/page";
import { authClient } from "@/lib/auth-client";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock session non authentifiee par defaut
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });
  });

  it("devrait appeler signIn.social avec Google", async () => {
    mockSignInSocial.mockResolvedValue({ data: {}, error: null });

    render(<LoginForm />);

    const googleButton = screen.getByRole("button", { name: /google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: expect.any(String),
      });
    });
  });

  it("devrait afficher une erreur si le login echoue", async () => {
    mockSignInSocial.mockRejectedValue(new Error("Network error"));

    render(<LoginForm />);

    const googleButton = screen.getByRole("button", { name: /google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeInTheDocument();
    });
  });
});
```

#### 1.3 Mock de useSession pour les composants proteges

```typescript
// __tests__/unit/components/user-menu.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mockUseSession,
    signOut: mockSignOut,
  },
}));

import { UserMenu } from "@/components/features/auth/user-menu";

describe("UserMenu", () => {
  it("devrait afficher le nom de l'utilisateur connecte", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "1", name: "John Doe", email: "john@test.com", image: null },
        session: { id: "session-1" },
      },
      isPending: false,
    });

    render(<UserMenu />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@test.com")).toBeInTheDocument();
  });

  it("devrait afficher un skeleton pendant le chargement", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
    });

    render(<UserMenu />);

    expect(screen.getByRole("generic")).toHaveClass("animate-pulse");
  });

  it("ne devrait rien afficher si non authentifie", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
    });

    const { container } = render(<UserMenu />);

    expect(container.firstChild).toBeNull();
  });
});
```

#### 1.4 Mock de auth.api.getSession (Server-side)

```typescript
// __tests__/unit/lib/auth-guard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du module auth
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock de next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

import { auth } from "@/lib/auth";
import { getAuthenticatedUser, requireAuth } from "@/lib/auth-guard";

describe("auth-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuthenticatedUser", () => {
    it("devrait retourner l'utilisateur si authentifie", async () => {
      const mockUser = { id: "1", name: "Test", email: "test@test.com" };

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: mockUser,
        session: { id: "session-1" },
      });

      const user = await getAuthenticatedUser();

      expect(user).toEqual(mockUser);
    });

    it("devrait retourner null si non authentifie", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const user = await getAuthenticatedUser();

      expect(user).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("devrait throw si non authentifie", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow("Unauthorized");
    });
  });
});
```

---

### 2. Tests d'Integration

#### 2.1 Setup: OTP Store pour tests

> **Pattern MCP**: Capturer les OTPs en memoire pour eviter l'envoi d'emails en tests.

```typescript
// __tests__/integration/setup/otp-store.ts
export const otpStore = new Map<string, string>();

export function setOtp(email: string, otp: string) {
  otpStore.set(email, otp);
}

export function getOtp(email: string): string {
  const code = otpStore.get(email);
  if (!code) throw new Error(`No OTP captured for ${email}`);
  return code;
}

export function clearOtpStore() {
  otpStore.clear();
}
```

```typescript
// lib/auth.ts - Configuration pour tests
import { otpStore, setOtp } from "@/__tests__/integration/setup/otp-store";

export const auth = betterAuth({
  // ... autres configs ...

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        if (process.env.NODE_ENV === "test") {
          // Capturer l'OTP au lieu d'envoyer un email
          setOtp(email, otp);
          return;
        }
        // Envoi reel en prod
        await sendEmail({ to: email, subject: "OTP", text: otp });
      },
    }),
  ],
});
```

#### 2.2 Helper: Creation de headers authentifies

> **Pattern MCP**: Utiliser l'API sign-in avec `returnHeaders: true` pour obtenir des cookies signes valides.

```typescript
// __tests__/integration/setup/auth-helpers.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOtp, clearOtpStore } from "./otp-store";
import setCookieParser from "set-cookie-parser";

interface TestUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Cree un utilisateur de test en DB
 */
export async function createTestUser(
  overrides: Partial<TestUser> = {}
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      email: overrides.email || `test-${Date.now()}@example.com`,
      name: overrides.name || "Test User",
      emailVerified: true,
    },
  });

  return user;
}

/**
 * Supprime un utilisateur de test
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Obtient des headers authentifies pour un utilisateur
 * UTILISE L'API Better Auth - ne pas creer de cookies manuellement!
 */
export async function createAuthenticationHeaders(
  email: string
): Promise<Headers> {
  // 1. Declencher l'envoi d'OTP (capture en memoire en mode test)
  await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });

  // 2. Recuperer l'OTP depuis le store
  const otp = getOtp(email);

  // 3. Sign-in avec returnHeaders: true pour obtenir les cookies signes
  const response = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });

  // 4. Extraire et formater les cookies
  const setCookies = response.headers.getSetCookie();
  const cookies = setCookies
    .map((c) => setCookieParser.parseString(c))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  if (!cookies) {
    throw new Error("No session cookies returned from sign-in");
  }

  return new Headers({
    Cookie: cookies,
    Origin: "http://localhost:3000", // IMPORTANT: requis par CSRF protection
  });
}

/**
 * Alternative: Sign-in avec email/password (si configure)
 */
export async function createAuthHeadersWithPassword(
  email: string,
  password: string
): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });

  const cookie = response.headers.getSetCookie()[0];

  if (!cookie) {
    throw new Error("No session cookie returned");
  }

  return new Headers({
    Cookie: cookie,
    Origin: "http://localhost:3000",
  });
}

/**
 * Cree une Request authentifiee
 */
export async function createAuthenticatedRequest(options: {
  url: string;
  method?: string;
  body?: unknown;
  user: TestUser;
}): Promise<Request> {
  const { url, method = "GET", body, user } = options;

  const authHeaders = await createAuthenticationHeaders(user.email);

  const headers = new Headers(authHeaders);
  if (body) {
    headers.set("Content-Type", "application/json");
  }

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

#### 2.3 Tests d'integration des API Routes

```typescript
// __tests__/integration/api/cv.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  createTestUser,
  deleteTestUser,
  createAuthenticatedRequest,
  createAuthenticationHeaders,
} from "../setup/auth-helpers";
import { clearOtpStore } from "../setup/otp-store";
import { GET, POST } from "@/app/api/cv/route";

describe("API /api/cv", () => {
  let testUser: { id: string; email: string; name: string };

  beforeAll(async () => {
    testUser = await createTestUser({ email: "cv-test@example.com" });
  });

  afterAll(async () => {
    await deleteTestUser(testUser.id);
    clearOtpStore();
  });

  describe("GET /api/cv", () => {
    it("devrait retourner 401 sans authentification", async () => {
      const request = new Request("http://localhost:3000/api/cv");

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("devrait retourner les CVs de l'utilisateur authentifie", async () => {
      // Creer un CV pour l'utilisateur
      const cv = await prisma.cV.create({
        data: {
          name: "Test CV",
          userId: testUser.id,
        },
      });

      try {
        const request = await createAuthenticatedRequest({
          url: "http://localhost:3000/api/cv",
          user: testUser,
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.cvs).toHaveLength(1);
        expect(data.cvs[0].name).toBe("Test CV");
      } finally {
        await prisma.cV.delete({ where: { id: cv.id } });
      }
    });
  });

  describe("POST /api/cv", () => {
    it("devrait creer un CV pour l'utilisateur authentifie", async () => {
      const request = await createAuthenticatedRequest({
        url: "http://localhost:3000/api/cv",
        method: "POST",
        body: { name: "New CV" },
        user: testUser,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.cv.name).toBe("New CV");
      expect(data.cv.userId).toBe(testUser.id);

      // Cleanup
      await prisma.cV.delete({ where: { id: data.cv.id } });
    });
  });
});
```

#### 2.4 Tests avec Supertest (Express-style)

```typescript
// __tests__/integration/api/auth-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { z } from "zod";

// Si vous avez un serveur Express/Hono
import { app } from "@/server";

describe("Auth Flow Integration", () => {
  let sessionCookie: string;

  it("devrait permettre sign-up puis acces aux routes protegees", async () => {
    // 1. Sign-up
    const signUpResponse = await request(app)
      .post("/api/auth/sign-up/email")
      .send({
        email: "newuser@test.com",
        password: "SecurePassword123!",
        name: "New User",
      });

    expect(signUpResponse.status).toBe(200);

    // 2. Extraire le cookie de session
    const rawCookie = signUpResponse.headers["set-cookie"];
    expect(rawCookie).toBeDefined();

    // Parser avec Zod pour type-safety
    const cookies = z.string().array().parse(rawCookie);
    const foundCookie = cookies.find((c) =>
      c.startsWith("better-auth.session_token=")
    );
    expect(foundCookie).toBeDefined();
    sessionCookie = foundCookie!;

    // 3. Acceder a une route protegee
    const protectedResponse = await request(app)
      .get("/api/user/profile")
      .set("Cookie", sessionCookie)
      .expect(200);

    expect(protectedResponse.body.user.email).toBe("newuser@test.com");
  });
});
```

---

### 3. Tests E2E (Playwright)

#### 3.1 Setup: Instance Better Auth pour Playwright

> **Pattern MCP**: Creer une instance Better Auth separee pour Playwright (necessaire si runtime different, ex: Bun vs Node).

```typescript
// playwright/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./database"; // better-sqlite3 pour Playwright (Node)
import { authOptions } from "@/lib/auth-options";
import * as schema from "@/lib/database/schema";

// Instance Better Auth pour Playwright (utilise Node, pas Bun)
export const playwrightAuth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
});
```

#### 3.2 Helper: Login par injection de cookies

```typescript
// playwright/fixtures/auth.ts
import { Page } from "@playwright/test";
import { playwrightAuth } from "../auth";
import { prisma } from "@/lib/db";
import { getOtp, setOtp } from "@/__tests__/integration/setup/otp-store";

interface TestUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Cree un utilisateur et l'authentifie par injection de cookies
 * BEAUCOUP plus rapide que le login UI (50-100x)
 */
export async function loginAndSaveUserToDatabase(options: {
  page: Page;
  user?: Partial<TestUser>;
}): Promise<TestUser> {
  const { page, user: userOverrides = {} } = options;

  // 1. Creer l'utilisateur en DB
  const user = await prisma.user.create({
    data: {
      email: userOverrides.email || `e2e-${Date.now()}@test.com`,
      name: userOverrides.name || "E2E Test User",
      emailVerified: true,
    },
  });

  // 2. Obtenir les cookies d'authentification
  await loginByCookie(page, user.email);

  return user;
}

/**
 * Injecte les cookies d'authentification dans le contexte Playwright
 */
async function loginByCookie(page: Page, email: string): Promise<void> {
  const authHeaders = await createPlaywrightAuthHeaders(email);
  const cookieHeader = authHeaders.get("Cookie")!;

  // Parser le header Cookie en objets Playwright
  const cookiePairs = cookieHeader.split("; ");
  const cookies = cookiePairs.map((pair) => {
    const [name, ...valueParts] = pair.split("=");
    const value = valueParts.join("=");

    return {
      name,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
    };
  });

  // Injecter les cookies dans le contexte du navigateur
  await page.context().addCookies(cookies);
}

/**
 * Obtient des headers authentifies via l'API Better Auth
 */
async function createPlaywrightAuthHeaders(email: string): Promise<Headers> {
  // Utiliser OTP pour le sign-in
  await playwrightAuth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });

  const otp = getOtp(email);

  const response = await playwrightAuth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });

  const setCookies = response.headers.getSetCookie();
  const cookies = setCookies
    .map((c) => {
      const [nameValue] = c.split(";");
      return nameValue;
    })
    .join("; ");

  return new Headers({ Cookie: cookies });
}

/**
 * Cleanup: supprimer l'utilisateur apres le test
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
```

#### 3.3 Tests E2E complets

```typescript
// playwright/tests/cv-workflow.spec.ts
import { test, expect } from "@playwright/test";
import {
  loginAndSaveUserToDatabase,
  cleanupTestUser,
} from "../fixtures/auth";

test.describe("CV Workflow", () => {
  let testUser: { id: string; email: string };

  test.beforeEach(async ({ page }) => {
    testUser = await loginAndSaveUserToDatabase({ page });
  });

  test.afterEach(async () => {
    if (testUser?.id) {
      await cleanupTestUser(testUser.id);
    }
  });

  test("devrait permettre de creer et editer un CV", async ({ page }) => {
    // L'utilisateur est deja authentifie via les cookies injectes
    await page.goto("/dashboard");

    // Verifier que l'utilisateur est connecte
    await expect(page.getByText(testUser.email)).toBeVisible();

    // Creer un nouveau CV
    await page.getByRole("button", { name: /nouveau cv/i }).click();
    await page.getByLabel("Nom du CV").fill("Mon Premier CV");
    await page.getByRole("button", { name: /creer/i }).click();

    // Verifier la redirection vers l'editeur
    await expect(page).toHaveURL(/\/cv\/[a-z0-9-]+/);

    // Editer le CV
    const editor = page.getByRole("textbox");
    await editor.fill("# John Doe\n\n## Experience\n\n- Developpeur Senior");

    // Sauvegarder (auto-save ou bouton)
    await page.waitForTimeout(2000); // Attendre auto-save

    // Verifier que les changements sont persistes
    await page.reload();
    await expect(editor).toContainText("John Doe");
  });

  test("devrait afficher les CVs existants", async ({ page }) => {
    await page.goto("/dashboard");

    // Verifier la presence de la liste des CVs
    await expect(page.getByRole("heading", { name: /mes cvs/i })).toBeVisible();
  });
});
```

#### 3.4 Tests de flux d'authentification UI

```typescript
// playwright/tests/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow (UI)", () => {
  test("devrait afficher la page de login pour les routes protegees", async ({
    page,
  }) => {
    // Tenter d'acceder a une route protegee sans auth
    await page.goto("/dashboard");

    // Devrait rediriger vers login
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("button", { name: /google/i })
    ).toBeVisible();
  });

  test("devrait gerer les erreurs de connexion", async ({ page }) => {
    await page.goto("/login");

    // Simuler une erreur (mock network ou provider indisponible)
    await page.route("**/api/auth/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );

    await page.getByRole("button", { name: /google/i }).click();

    // Verifier le message d'erreur
    await expect(page.getByText(/erreur/i)).toBeVisible();
  });
});
```

---

### 4. Pieges courants et solutions (MCP Better Auth)

#### 4.1 Erreur: `MISSING_OR_NULL_ORIGIN`

**Cause**: Better Auth valide l'header `Origin` quand des cookies sont presents (protection CSRF).

**Solution**:
```typescript
// Toujours inclure Origin dans les requests de test
const headers = new Headers({
  Cookie: sessionCookie,
  Origin: "http://localhost:3000", // REQUIS!
});
```

#### 4.2 Erreur: Cookies non valides

**Cause**: Les cookies Better Auth sont signes et encodes. Creer un cookie manuellement ne fonctionne pas.

**Solution**: Toujours utiliser l'API sign-in avec `returnHeaders: true`:
```typescript
// MAUVAIS - ne fonctionne pas
const headers = new Headers({
  Cookie: `better-auth.session_token=${rawToken}`, // NON!
});

// BON - utiliser l'API
const response = await auth.api.signInEmail({
  body: { email, password },
  returnHeaders: true, // Obtient les cookies signes
});
const cookie = response.headers.getSetCookie()[0];
```

#### 4.3 Erreur: Premier request OK, suivants echouent

**Cause**: La premiere request n'a pas de cookies, donc pas de validation Origin. Les suivantes avec cookies necessitent Origin.

**Solution**: Inclure `Origin` des le debut ou desactiver temporairement en dev:
```typescript
// UNIQUEMENT pour dev/test isole
export const auth = betterAuth({
  advanced: {
    disableCSRFCheck: process.env.NODE_ENV === "test",
  },
});
```

#### 4.4 Performance: Tests lents

**Cause**: Hash de mot de passe scrypt est lent.

**Solution**: Utiliser un hash plus rapide en tests:
```typescript
// lib/auth.ts
export const auth = betterAuth({
  // ...
  password:
    process.env.NODE_ENV === "test"
      ? {
          hash: async (pwd) => `hashed:${pwd}`, // Hash simple pour tests
          verify: async ({ hash, password }) => hash === `hashed:${password}`,
        }
      : undefined, // scrypt par defaut en prod
});
```

---

### 5. Checklist pre-commit pour les tests

- [ ] **Unitaires**: Mock `authClient` AVANT les imports
- [ ] **Integration**: Utiliser `returnHeaders: true` pour obtenir les cookies
- [ ] **E2E**: Injecter cookies via `page.context().addCookies()`
- [ ] **CSRF**: Inclure header `Origin` dans toutes les requests avec cookies
- [ ] **Isolation**: Chaque test cree/supprime son propre utilisateur
- [ ] **Cleanup**: Supprimer les donnees de test en `afterEach`/`afterAll`

---

### 6. Scripts npm recommandes

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --dir __tests__/unit",
    "test:integration": "vitest run --dir __tests__/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Phase 2: Migration vers l'edition collaborative

### 2.1 Installation Lexical + Y.js

```bash
pnpm add lexical @lexical/react @lexical/yjs yjs y-websocket
pnpm add @lexical/rich-text @lexical/list @lexical/link @lexical/markdown
pnpm add -D @types/yjs
```

### 2.2 Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Lexical       │  │   Y.js Doc      │  │  Presence       │  │
│  │   Editor        │◄─┤   (CRDT)        │◄─┤  (Cursors)      │  │
│  └─────────────────┘  └────────┬────────┘  └─────────────────┘  │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │ WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Y-WebSocket Server                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Room Manager  │  │   Persistence   │  │   Auth Check    │  │
│  │   (per CV)      │  │   (Redis/DB)    │  │   (Better Auth) │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

> **Note**: Better Auth ne gere pas nativement le temps reel. Le serveur Y-WebSocket doit valider les sessions Better Auth via les cookies.

### 2.3 Composant Lexical collaboratif

Creer `components/features/cv/collaborative-editor.tsx`:

```typescript
"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

interface CollaborativeEditorProps {
  cvId: string;
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
}

const editorConfig = {
  namespace: "CVEditor",
  theme: {
    paragraph: "mb-2",
    heading: {
      h1: "text-3xl font-bold mb-4",
      h2: "text-2xl font-bold mb-3",
      h3: "text-xl font-bold mb-2",
    },
    list: {
      ul: "list-disc ml-4",
      ol: "list-decimal ml-4",
      listitem: "mb-1",
    },
    quote: "border-l-4 border-gray-300 pl-4 italic",
  },
  nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
  onError: (error: Error) => console.error(error),
};

function createWebSocketProvider(
  id: string,
  yjsDocMap: Map<string, Y.Doc>
): WebsocketProvider {
  const doc = new Y.Doc();
  yjsDocMap.set(id, doc);

  return new WebsocketProvider(
    process.env.NEXT_PUBLIC_YWEBSOCKET_URL || "ws://localhost:1234",
    `cv-${id}`,
    doc,
    { connect: true }
  );
}

export function CollaborativeEditor({
  cvId,
  initialMarkdown,
  onChange,
}: CollaborativeEditorProps) {
  const { user } = useCurrentUser();

  const initialConfig = {
    ...editorConfig,
    editorState: null, // Y.js gere l'etat
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="editor-input min-h-[400px] p-4 outline-none prose prose-sm max-w-none" />
          }
          placeholder={
            <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
              Commencez a editer...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />

        <CollaborationPlugin
          id={cvId}
          providerFactory={createWebSocketProvider}
          shouldBootstrap={!initialMarkdown}
          username={user?.name || "Anonyme"}
          cursorColor={getRandomColor(user?.id)}
        />

        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      </div>
    </LexicalComposer>
  );
}

function getRandomColor(seed?: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  ];

  if (!seed) return colors[0];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
```

### 2.4 Serveur Y-WebSocket

Creer `server/yjs-server.ts`:

```typescript
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";
import { auth } from "@/lib/auth";

const wss = new WebSocketServer({ port: 1234 });

wss.on("connection", async (ws, req) => {
  const cookies = req.headers.cookie;

  // Verifier l'authentification via Better Auth
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookies || "" }),
  });

  if (!session) {
    ws.close(4001, "Non autorise");
    return;
  }

  const roomName = req.url?.slice(1) || "default";

  // TODO: Verifier que l'utilisateur a acces a ce CV (CVAccess)

  setupWSConnection(ws, req, {
    docName: roomName,
    gc: true,
  });

  console.log(`User ${session.user.email} joined room ${roomName}`);
});

console.log("Y-WebSocket server running on ws://localhost:1234");
```

### 2.5 Variables d'environnement supplementaires

```env
# WebSocket (Y.js)
NEXT_PUBLIC_YWEBSOCKET_URL=ws://localhost:1234
YWEBSOCKET_PORT=1234
```

---

## Phase 3: Modele de donnees collaboratif

### 3.1 Nouvelles tables pour la collaboration

```prisma
// Permissions d'acces aux CVs
model CVAccess {
  id        String     @id @default(cuid())
  cvId      String
  cv        CV         @relation(fields: [cvId], references: [id], onDelete: Cascade)
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      AccessRole @default(VIEWER)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@unique([cvId, userId])
  @@index([cvId])
  @@index([userId])
}

enum AccessRole {
  OWNER     // Peut tout faire + supprimer + gerer acces
  EDITOR    // Peut editer le contenu
  COMMENTER // Peut commenter uniquement
  VIEWER    // Lecture seule
}

// Commentaires sur le CV
model CVComment {
  id        String   @id @default(cuid())
  cvId      String
  cv        CV       @relation(fields: [cvId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  content   String   @db.Text
  resolved  Boolean  @default(false)

  // Position dans le document (commentaires inline)
  anchorKey    String?
  anchorOffset Int?

  // Thread de reponses
  parentId  String?
  parent    CVComment?  @relation("CommentThread", fields: [parentId], references: [id], onDelete: Cascade)
  replies   CVComment[] @relation("CommentThread")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([cvId])
  @@index([userId])
  @@index([parentId])
}

// Historique des modifications (audit trail)
model CVHistory {
  id        String        @id @default(cuid())
  cvId      String
  cv        CV            @relation(fields: [cvId], references: [id], onDelete: Cascade)
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  action    HistoryAction
  snapshot  String?       @db.Text
  diff      String?       @db.Text

  createdAt DateTime @default(now())

  @@index([cvId])
  @@index([userId])
  @@index([createdAt])
}

enum HistoryAction {
  CREATED
  EDITED
  IMPROVED    // Agent IA
  GENERATED   // DOCX genere
  SHARED
  COMMENTED
}
```

### 3.2 Mise a jour du modele CV

```prisma
model CV {
  // ... champs existants ...

  // Collaboration
  accesses  CVAccess[]
  comments  CVComment[]
  history   CVHistory[]

  // Y.js state (persistence optionnelle)
  yjsState  Bytes?
}
```

---

## Phase 4: Checklist d'implementation

### Etape 1: Better Auth (Priorite haute)

- [ ] Installer `better-auth` et `@better-auth/cli`
- [ ] Configurer Google Cloud Console
- [ ] Ajouter variables `.env`
- [ ] Generer tables Prisma avec CLI (`pnpm dlx @better-auth/cli generate`)
- [ ] Ajouter `userId` aux tables existantes
- [ ] Executer migration Prisma (`pnpm db:push`)
- [ ] Creer `lib/auth.ts` avec config complete
- [ ] Creer route API `app/api/auth/[...all]/route.ts`
- [ ] Creer `lib/auth-client.ts`
- [ ] Creer `lib/auth-guard.ts` (helpers server)
- [ ] Ajouter middleware de protection
- [ ] Creer page login avec Google OAuth
- [ ] Creer hook `useCurrentUser`
- [ ] Creer composant `UserMenu`
- [ ] Proteger les routes API existantes
- [ ] Tester le flux complet

### Etape 2: Migration CVs existants

- [ ] Script de migration pour assigner les CVs existants
- [ ] Ajouter UI pour selectionner le proprietaire
- [ ] OU: Assigner tous les CVs au premier utilisateur admin

### Etape 3: Lexical + Y.js (Priorite moyenne)

- [ ] Installer dependances Lexical
- [ ] Creer composant `CollaborativeEditor`
- [ ] Configurer serveur Y-WebSocket avec auth
- [ ] Remplacer MDXEditor par CollaborativeEditor
- [ ] Tester edition collaborative multi-onglets
- [ ] Ajouter persistence Y.js (Redis ou DB)

### Etape 4: Modele collaboratif (Priorite basse)

- [ ] Ajouter tables CVAccess, CVComment, CVHistory
- [ ] Implementer systeme de partage
- [ ] Ajouter commentaires inline
- [ ] Implementer historique des versions

---

## Risques et considerations

### Performance

- Y.js CRDT peut devenir lourd sur de gros documents
- Prevoir pagination/chunking pour l'historique
- Cache Redis recommande pour la persistence Y.js
- Utiliser `cookieCache` Better Auth pour reduire DB calls

### Securite

- Valider l'acces au CV dans le serveur WebSocket
- Ne pas exposer les sessions dans le client
- Rate limiting sur les routes API (configure dans Better Auth)
- Middleware = check optimiste, vraie validation dans pages/routes

### Migration

- Prevoir un mode "lecture seule" pendant la migration
- Backup des donnees avant migration schema
- Tests de non-regression sur l'extraction/generation

### UX

- Indicateur de presence (qui edite quoi)
- Curseurs colores par utilisateur
- Notification de conflits (rare avec CRDT)
- Gestion gracieuse des erreurs 429 (rate limit)

---

## Ressources

### Documentation officielle

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth - Next.js Integration](https://www.better-auth.com/docs/integrations/next)
- [Better Auth - Session Management](https://www.better-auth.com/docs/concepts/session-management)
- [Better Auth - Rate Limiting](https://www.better-auth.com/docs/concepts/rate-limit)
- [Better Auth - Hooks](https://www.better-auth.com/docs/concepts/hooks)

### Lexical & Y.js

- [Lexical Documentation](https://lexical.dev/docs)
- [Y.js Documentation](https://docs.yjs.dev)
- [Y-WebSocket](https://github.com/yjs/y-websocket)

### Discussions GitHub utiles

- [Test utilities feature request](https://github.com/better-auth/better-auth/issues/5609)
- [OAuth registration hooks](https://github.com/better-auth/better-auth/discussions/5886)
- [Account linking patterns](https://github.com/better-auth/better-auth/discussions/6385)

---

## Timeline estimee

| Phase | Description | Complexite |
|-------|-------------|------------|
| 1 | Better Auth + Google OAuth | Moyenne |
| 2 | Migration utilisateurs existants | Faible |
| 3 | Lexical + Y.js basique | Haute |
| 4 | Collaboration complete | Haute |

**Note**: La Phase 1 peut etre deployee independamment. Les phases 3 et 4 peuvent etre iterees progressivement.

---

*Document genere et enrichi avec les informations du MCP Better Auth - Fevrier 2026*
