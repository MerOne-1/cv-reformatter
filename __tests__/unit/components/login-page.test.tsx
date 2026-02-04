/**
 * Tests du composant LoginPage
 *
 * Pattern recommande par Better Auth MCP (doc lignes 1049-1077).
 * NOTE: vi.mock est hoiste - les variables doivent etre definies dans la factory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Variable pour controler le mock de searchParams.get
let mockCallbackUrl: string | null = null;

// Mock auth-client avec fonctions inline (hoisting-safe)
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
    useSession: vi.fn(),
    signOut: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'callbackUrl') return mockCallbackUrl;
      return null;
    },
  }),
}));

// Importer APRES les mocks
import { authClient } from '@/lib/auth-client';
import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallbackUrl = null;
  });

  describe('Rendu initial', () => {
    it('devrait afficher le titre de connexion', () => {
      render(<LoginPage />);

      expect(screen.getByText('Connexion')).toBeInTheDocument();
    });

    it('devrait afficher le bouton Google', () => {
      render(<LoginPage />);

      expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    });

    it('devrait afficher le texte descriptif', () => {
      render(<LoginPage />);

      expect(
        screen.getByText(/Connectez-vous avec votre compte Google/i)
      ).toBeInTheDocument();
    });
  });

  describe('Google Sign In', () => {
    it('devrait appeler signIn.social avec Google au clic', async () => {
      vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(authClient.signIn.social).toHaveBeenCalledWith({
          provider: 'google',
          callbackURL: '/',
        });
      });
    });

    it('devrait utiliser le callbackUrl des searchParams si valide', async () => {
      mockCallbackUrl = '/dashboard';
      vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(authClient.signIn.social).toHaveBeenCalledWith({
          provider: 'google',
          callbackURL: '/dashboard',
        });
      });
    });

    it('devrait rejeter les callbackUrl externes (open redirect protection)', async () => {
      mockCallbackUrl = 'https://evil.com/phishing';
      vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        // Devrait utiliser '/' au lieu de l'URL malveillante
        expect(authClient.signIn.social).toHaveBeenCalledWith({
          provider: 'google',
          callbackURL: '/',
        });
      });
    });

    it('devrait rejeter les URL protocol-relative (//evil.com)', async () => {
      mockCallbackUrl = '//evil.com';
      vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(authClient.signIn.social).toHaveBeenCalledWith({
          provider: 'google',
          callbackURL: '/',
        });
      });
    });

    it('devrait rejeter les URL avec backslash (path traversal)', async () => {
      mockCallbackUrl = '/foo\\bar';
      vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(authClient.signIn.social).toHaveBeenCalledWith({
          provider: 'google',
          callbackURL: '/',
        });
      });
    });
  });

  describe('Etats de chargement', () => {
    it('devrait afficher le spinner pendant le chargement', async () => {
      vi.mocked(authClient.signIn.social).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/Connexion en cours/i)).toBeInTheDocument();
      });
    });

    it('devrait desactiver le bouton pendant le chargement', async () => {
      vi.mocked(authClient.signIn.social).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(googleButton).toBeDisabled();
      });
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait afficher une erreur si le login echoue', async () => {
      vi.mocked(authClient.signIn.social).mockRejectedValue(new Error('Network error'));

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/erreur/i)).toBeInTheDocument();
      });
    });

    it('devrait reactiver le bouton apres une erreur', async () => {
      vi.mocked(authClient.signIn.social).mockRejectedValue(new Error('Network error'));

      render(<LoginPage />);

      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(googleButton).not.toBeDisabled();
      });
    });
  });
});
