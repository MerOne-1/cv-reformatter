'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

/**
 * Validates that a callback URL is safe (relative path only).
 * Prevents open redirect vulnerabilities.
 */
function isValidCallbackUrl(url: string): boolean {
  // Must start with / but not // (protocol-relative URL)
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false;
  }
  // Block any URL that could be interpreted as absolute
  if (url.includes(':') || url.includes('\\')) {
    return false;
  }
  return true;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl') || '/';
  const callbackUrl = isValidCallbackUrl(rawCallbackUrl) ? rawCallbackUrl : '/';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: callbackUrl,
      });
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Erreur lors de la connexion. Veuillez reessayer.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-[360px]">
        {/* Mobile logo */}
        <div className="lg:hidden mb-12 text-center">
          <div className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1c1c1c] flex items-center justify-center">
              <span className="text-white font-display font-semibold">CV</span>
            </div>
            <span className="text-[#1c1c1c] font-display text-lg tracking-tight">Reformatter</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-[26px] text-[#1c1c1c] tracking-tight mb-2">
            Connexion
          </h1>
          <p className="text-[#8c8c8c] text-[15px]">
            Connectez-vous avec votre compte Google
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className={cn(
            "w-full h-14 rounded-xl font-medium text-[15px]",
            "bg-white border border-[#e5e5e5] text-[#1c1c1c]",
            "flex items-center justify-center gap-3",
            "transition-all duration-150",
            "hover:bg-[#fafafa] hover:border-[#d5d5d5]",
            "active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connexion en cours...
            </span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuer avec Google
            </>
          )}
        </button>

        {/* Info text */}
        <p className="text-center text-[13px] text-[#8c8c8c] mt-8">
          En vous connectant, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-8 h-8 rounded-full border-2 border-[#1c1c1c] border-t-transparent animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="light min-h-screen bg-[#f8f8f7] flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#1c1c1c] relative overflow-hidden">
        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white font-display font-semibold text-lg">CV</span>
              </div>
              <span className="text-white/90 font-display text-xl tracking-tight">Reformatter</span>
            </div>
          </div>

          {/* Central content */}
          <div className="max-w-md">
            <h2 className="font-display text-[2.75rem] leading-[1.1] text-white tracking-tight mb-6">
              L'outil de reformatage CV pour vos consultants
            </h2>
            <p className="text-white/50 text-lg leading-relaxed">
              Transformez rapidement les CVs de vos consultants au format de l'entreprise.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-8">
            <span className="text-white/30 text-sm">DreamIT</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 text-sm">Rupturae</span>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <Suspense fallback={<LoginFallback />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
