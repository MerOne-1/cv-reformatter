/**
 * Tests du composant UserMenu
 *
 * Pattern recommande par Better Auth MCP (doc lignes 1083-1137).
 * NOTE: Les tests du dropdown sont simplifies car Radix UI utilise des portals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock auth-client avec fonctions inline (hoisting-safe)
vi.mock('@/lib/auth-client', () => ({
  authClient: {
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
}));

// Importer APRES les mocks
import { authClient } from '@/lib/auth-client';
import { UserMenu } from '@/components/features/auth/user-menu';

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Etat de chargement', () => {
    it('devrait afficher un skeleton pendant le chargement', () => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      } as ReturnType<typeof authClient.useSession>);

      render(<UserMenu />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Etat non authentifie', () => {
    it('ne devrait rien afficher si non authentifie', () => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      } as ReturnType<typeof authClient.useSession>);

      const { container } = render(<UserMenu />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Etat erreur', () => {
    it('devrait afficher un bouton erreur si la session a echoue', () => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
        error: new Error('Session fetch failed'),
      } as ReturnType<typeof authClient.useSession>);

      render(<UserMenu />);

      const errorButton = screen.getByRole('button');
      expect(errorButton).toBeInTheDocument();
      expect(errorButton).toHaveAttribute('title', expect.stringContaining('Erreur'));
    });
  });

  describe('Etat authentifie', () => {
    const mockUser = {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: true,
      image: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSession = {
      id: 'session-123',
      userId: 'user-123',
      token: 'token',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: { user: mockUser, session: mockSession },
        isPending: false,
        error: null,
      } as ReturnType<typeof authClient.useSession>);
    });

    it('devrait afficher l\'avatar de l\'utilisateur', () => {
      render(<UserMenu />);

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', expect.stringContaining('avatar.jpg'));
    });

    it('devrait afficher les initiales si pas d\'image', () => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: {
          user: { ...mockUser, image: null },
          session: mockSession,
        },
        isPending: false,
        error: null,
      } as ReturnType<typeof authClient.useSession>);

      render(<UserMenu />);

      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('devrait gerer les noms avec espaces multiples', () => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: {
          user: { ...mockUser, name: 'John  Michael  Doe', image: null },
          session: mockSession,
        },
        isPending: false,
        error: null,
      } as ReturnType<typeof authClient.useSession>);

      render(<UserMenu />);

      // Devrait filtrer les espaces vides et afficher "JMD"
      expect(screen.getByText('JMD')).toBeInTheDocument();
    });

    it('devrait afficher "?" si pas de nom', () => {
      vi.mocked(authClient.useSession).mockReturnValue({
        data: {
          user: { ...mockUser, name: null, image: null },
          session: mockSession,
        },
        isPending: false,
        error: null,
      } as ReturnType<typeof authClient.useSession>);

      render(<UserMenu />);

      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('devrait rendre un bouton trigger pour le menu', () => {
      render(<UserMenu />);

      const trigger = screen.getByRole('button');
      expect(trigger).toBeInTheDocument();
    });

    it('le bouton trigger devrait etre focusable', () => {
      render(<UserMenu />);

      const trigger = screen.getByRole('button');
      trigger.focus();

      expect(document.activeElement).toBe(trigger);
    });
  });
});
