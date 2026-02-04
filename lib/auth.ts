import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],

  // ==========================================
  // PROVIDERS
  // ==========================================
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    storage: "memory", // Utiliser "database" en prod avec table RateLimit
    customRules: {
      // Regles strictes pour endpoints sensibles
      "/sign-in/social": { window: 10, max: 5 },
      "/sign-up/*": { window: 60, max: 5 },
    },
  },

  // ==========================================
  // ACCOUNT LINKING
  // ==========================================
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
    },
  },

  // ==========================================
  // ADVANCED
  // ==========================================
  advanced: {
    ipAddress: {
      // Headers pour detecter l'IP reelle (Cloudflare, Vercel, proxies)
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
    },
  },

  // ==========================================
  // HOOKS (lifecycle callbacks)
  // ==========================================
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Log user ID only, not email (PII/GDPR compliance)
          console.log(`[Better Auth] New user created: ${user.id}`);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          console.log(`[Better Auth] New session for user: ${session.userId}`);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
