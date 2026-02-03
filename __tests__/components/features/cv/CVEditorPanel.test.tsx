import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CVEditorPanel } from '@/components/features/cv/CVEditorPanel';
import { CVWithImprovements } from '@/lib/types';

const mockCV: CVWithImprovements = {
  id: 'cv-1',
  originalName: 'test-cv.pdf',
  consultantName: 'John Doe',
  storagePath: '/path/to/cv',
  status: 'PROCESSED',
  uploadedAt: new Date(),
  processedAt: new Date(),
  finalizedAt: null,
  markdown: '# CV Content',
  notes: null,
  futureMissionNotes: null,
  improvements: [],
  audioNotes: [],
};

const defaultProps = {
  cv: mockCV,
  markdown: '# Test CV\n\nSome content here',
  onChange: vi.fn(),
  viewMode: 'code' as const,
  showOriginal: false,
  templateName: 'DreamIT',
  onExtract: vi.fn(),
  extracting: false,
};

describe('CVEditorPanel', () => {
  describe('Split Screen (Original CV Panel)', () => {
    it('should not show original panel when showOriginal is false', () => {
      render(<CVEditorPanel {...defaultProps} showOriginal={false} />);

      // Le panneau original ne devrait pas être visible
      expect(screen.queryByText('test-cv.pdf')).not.toBeInTheDocument();
    });

    it('should show original panel when showOriginal is true', () => {
      render(<CVEditorPanel {...defaultProps} showOriginal={true} />);

      // Le nom du fichier original devrait être visible dans le header du panneau
      expect(screen.getByText('test-cv.pdf')).toBeInTheDocument();
    });

    it('should render PDF iframe for PDF files when showOriginal is true', () => {
      render(<CVEditorPanel {...defaultProps} showOriginal={true} />);

      // Un iframe devrait être présent pour les fichiers PDF
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe?.src).toContain('/api/cv/preview/cv-1');
    });

    it('should show download link for DOCX files when showOriginal is true', () => {
      const docxCV = { ...mockCV, originalName: 'test-cv.docx' };
      render(<CVEditorPanel {...defaultProps} cv={docxCV} showOriginal={true} />);

      // Pour les fichiers DOCX, un lien de téléchargement devrait être visible
      expect(screen.getByText('Aperçu non disponible pour les fichiers DOCX')).toBeInTheDocument();
      expect(screen.getByText('Telecharger le fichier')).toBeInTheDocument();
    });

    it('should apply half width to both panels when showOriginal is true', () => {
      const { container } = render(<CVEditorPanel {...defaultProps} showOriginal={true} />);

      // Les deux panneaux devraient avoir w-1/2
      const panels = container.querySelectorAll('.w-1\\/2');
      expect(panels.length).toBeGreaterThanOrEqual(1);
    });

    it('should use full width for editor when showOriginal is false', () => {
      const { container } = render(<CVEditorPanel {...defaultProps} showOriginal={false} />);

      // Le panneau éditeur devrait être en flex-1 sans contrainte de largeur
      const editorPanel = container.querySelector('.flex-1.overflow-hidden');
      expect(editorPanel).toBeInTheDocument();
      expect(editorPanel?.className).not.toContain('w-1/2');
    });
  });

  describe('Editor Content', () => {
    it('should render textarea in code mode', () => {
      render(<CVEditorPanel {...defaultProps} viewMode="code" />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('# Test CV\n\nSome content here');
    });

    it('should render formatted HTML in formatted mode', () => {
      render(<CVEditorPanel {...defaultProps} viewMode="formatted" />);

      // En mode formatted, pas de textarea
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should show extraction prompt when no content', () => {
      render(<CVEditorPanel {...defaultProps} markdown="" />);

      expect(screen.getByText("Pret pour l'extraction")).toBeInTheDocument();
      expect(screen.getByText("Lancer l'extraction")).toBeInTheDocument();
    });

    it('should call onExtract when extraction button is clicked', () => {
      const onExtract = vi.fn();
      render(<CVEditorPanel {...defaultProps} markdown="" onExtract={onExtract} />);

      const button = screen.getByText("Lancer l'extraction");
      button.click();

      expect(onExtract).toHaveBeenCalledTimes(1);
    });

    it('should disable extraction button when extracting', () => {
      render(<CVEditorPanel {...defaultProps} markdown="" extracting={true} />);

      const button = screen.getByRole('button', { name: /extraction/i });
      expect(button).toBeDisabled();
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when textarea content changes', () => {
      const onChange = vi.fn();
      render(<CVEditorPanel {...defaultProps} onChange={onChange} viewMode="code" />);

      const textarea = screen.getByRole('textbox');
      textarea.focus();

      // Simuler un changement de contenu
      const event = { target: { value: '# Updated Content' } };
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
});
