import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth catch-all route handler
export const { GET, POST } = toNextJsHandler(auth);
