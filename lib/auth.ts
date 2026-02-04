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

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      accessType: "offline",
      prompt: "select_account consent",
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh each day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache cookie 5 min
    },
  },

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
