"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Mail, Lock, LogIn, AlertCircle, Loader2, FileText } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await authClient.signIn.email({
        email,
        password,
      });

      if (response.error) {
        setError(response.error.message || "Identifiants incorrects");
        setIsLoading(false);
        return;
      }

      router.refresh();
      router.push("/");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary dreamit orb */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--dreamit)) 0%, transparent 70%)",
            top: "-15%",
            right: "-10%",
            animation: "float-slow 20s ease-in-out infinite",
          }}
        />
        {/* Secondary rupturae orb */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--rupturae)) 0%, transparent 70%)",
            bottom: "-20%",
            left: "-15%",
            animation: "float-slow 25s ease-in-out infinite reverse",
          }}
        />
        {/* Accent orb */}
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-10 blur-[80px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--dreamit-glow)) 0%, transparent 70%)",
            top: "40%",
            left: "10%",
            animation: "float-slow 15s ease-in-out infinite",
          }}
        />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Main content */}
      <div
        className={`relative z-10 w-full max-w-md px-6 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Logo and title */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 relative"
            style={{
              background: "linear-gradient(135deg, hsl(var(--dreamit)) 0%, hsl(var(--dreamit-glow)) 100%)",
              boxShadow: "0 8px 32px -4px hsl(var(--dreamit) / 0.4), inset 0 1px 0 0 rgba(255,255,255,0.2)",
            }}
          >
            <FileText className="w-8 h-8 text-white" />
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-2xl animate-pulse-glow"
              style={{ animationDuration: "3s" }}
            />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
            <span className="text-gradient-dreamit">CV</span>
            <span className="text-foreground"> Reformatter</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Connectez-vous pour accéder à l&apos;application
          </p>
        </div>

        {/* Login card */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "hsl(var(--card) / 0.6)",
            backdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid hsl(var(--border) / 0.5)",
            boxShadow: `
              0 24px 48px -12px rgba(0, 0, 0, 0.4),
              0 0 0 1px hsl(var(--border-subtle)),
              inset 0 1px 0 0 rgba(255, 255, 255, 0.03)
            `,
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--dreamit) / 0.5), hsl(var(--dreamit-glow) / 0.3), transparent)",
            }}
          />

          <div className="p-8">
            {/* Error message */}
            {error && (
              <div
                className="mb-6 p-4 rounded-xl flex items-start gap-3 animate-fade-in-up"
                style={{
                  background: "hsl(var(--destructive) / 0.1)",
                  border: "1px solid hsl(var(--destructive) / 0.2)",
                }}
              >
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground/80 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Adresse email
                </label>
                <div className="relative group">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@entreprise.com"
                    required
                    disabled={isLoading}
                    className="w-full h-12 px-4 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: "hsl(var(--input) / 0.5)",
                      border: "1px solid hsl(var(--border))",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "hsl(var(--dreamit) / 0.5)";
                      e.target.style.boxShadow = "0 0 0 3px hsl(var(--dreamit) / 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "hsl(var(--border))";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground/80 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Mot de passe
                </label>
                <div className="relative group">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="w-full h-12 px-4 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: "hsl(var(--input) / 0.5)",
                      border: "1px solid hsl(var(--border))",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "hsl(var(--dreamit) / 0.5)";
                      e.target.style.boxShadow = "0 0 0 3px hsl(var(--dreamit) / 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "hsl(var(--border))";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="dreamit"
                  size="lg"
                  disabled={isLoading}
                  className="w-full h-12 text-base font-medium relative overflow-hidden group"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Connexion en cours...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                      <span>Se connecter</span>
                    </>
                  )}
                  {/* Shimmer effect on hover */}
                  <div
                    className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                    }}
                  />
                </Button>
              </div>
            </form>
          </div>

          {/* Bottom info */}
          <div
            className="px-8 py-4 text-center"
            style={{
              background: "hsl(var(--background) / 0.3)",
              borderTop: "1px solid hsl(var(--border) / 0.3)",
            }}
          >
            <p className="text-xs text-muted-foreground">
              Accès réservé aux utilisateurs autorisés
            </p>
          </div>
        </div>

        {/* Footer branding */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground/60">
            Propulsé par{" "}
            <span className="text-gradient-dreamit font-medium">DreamIT</span>
            {" "}×{" "}
            <span className="text-gradient-rupturae font-medium">Rupturae</span>
          </p>
        </div>
      </div>

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
