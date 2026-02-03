import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CVToolbar } from '@/components/features/cv/CVToolbar';
import { CVWithImprovements } from '@/lib/types';

// Mock des composants externes
vi.mock('@/components/layout/template-selector', () => ({
  TemplateSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="template-selector" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="DreamIT">DreamIT</option>
    </select>
  ),
}));

vi.mock('@/components/features/cv/CVNotesDialog', () => ({
  CVNotesDialog: () => null,
}));

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
  templateName: 'DreamIT',
  onTemplateChange: vi.fn(),
  hasContent: true,
  viewMode: 'code' as const,
  onViewModeChange: vi.fn(),
  showOriginal: false,
  onToggleOriginal: vi.fn(),
  onExtract: vi.fn(),
  onRunWorkflow: vi.fn(),
  onGenerate: vi.fn(),
  onUploadFinal: vi.fn(),
  onPreview: vi.fn(),
  extracting: false,
  runningWorkflow: false,
  workflowProgress: null,
  generating: false,
  uploading: false,
  notes: null,
  futureMissionNotes: null,
  onNotesChange: vi.fn(),
  audioNotes: [],
  onAudioNotesChange: vi.fn(),
};

describe('CVToolbar', () => {
  describe('Split Screen Button (Original CV Toggle)', () => {
    it('should render the split screen button when hasContent is true', () => {
      render(<CVToolbar {...defaultProps} />);

      const button = screen.getByTitle("Voir l'original");
      expect(button).toBeInTheDocument();
    });

    it('should not render the split screen button when hasContent is false', () => {
      render(<CVToolbar {...defaultProps} hasContent={false} />);

      const button = screen.queryByTitle("Voir l'original");
      expect(button).not.toBeInTheDocument();
    });

    it('should call onToggleOriginal when clicked', () => {
      const onToggleOriginal = vi.fn();
      render(<CVToolbar {...defaultProps} onToggleOriginal={onToggleOriginal} />);

      const button = screen.getByTitle("Voir l'original");
      fireEvent.click(button);

      expect(onToggleOriginal).toHaveBeenCalledTimes(1);
    });

    it('should show "Fermer l\'original" title when showOriginal is true', () => {
      render(<CVToolbar {...defaultProps} showOriginal={true} />);

      const button = screen.getByTitle("Fermer l'original");
      expect(button).toBeInTheDocument();
    });

    it('should show "Voir l\'original" title when showOriginal is false', () => {
      render(<CVToolbar {...defaultProps} showOriginal={false} />);

      const button = screen.getByTitle("Voir l'original");
      expect(button).toBeInTheDocument();
    });

    it('should have secondary variant when showOriginal is true', () => {
      render(<CVToolbar {...defaultProps} showOriginal={true} />);

      const button = screen.getByTitle("Fermer l'original");
      // Le bouton devrait avoir la classe secondary
      expect(button.className).toContain('secondary');
    });

    it('should have outline variant when showOriginal is false', () => {
      render(<CVToolbar {...defaultProps} showOriginal={false} />);

      const button = screen.getByTitle("Voir l'original");
      // Le bouton devrait avoir la classe outline ou border
      expect(button.className).toMatch(/outline|border/);
    });

    it('should toggle between states correctly', () => {
      const onToggleOriginal = vi.fn();
      const { rerender } = render(
        <CVToolbar {...defaultProps} showOriginal={false} onToggleOriginal={onToggleOriginal} />
      );

      // Initial state - should show "Voir l'original"
      expect(screen.getByTitle("Voir l'original")).toBeInTheDocument();

      // Click to toggle
      fireEvent.click(screen.getByTitle("Voir l'original"));
      expect(onToggleOriginal).toHaveBeenCalled();

      // Rerender with showOriginal=true to simulate state change
      rerender(
        <CVToolbar {...defaultProps} showOriginal={true} onToggleOriginal={onToggleOriginal} />
      );

      // Now should show "Fermer l'original"
      expect(screen.getByTitle("Fermer l'original")).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('should call onViewModeChange when view mode button is clicked', () => {
      const onViewModeChange = vi.fn();
      render(<CVToolbar {...defaultProps} onViewModeChange={onViewModeChange} viewMode="code" />);

      // Le bouton affiche "Aperçu" quand on est en mode code
      const button = screen.getByRole('button', { name: /Aperçu/i });
      fireEvent.click(button);

      expect(onViewModeChange).toHaveBeenCalledWith('formatted');
    });

    it('should switch to code mode when in formatted mode', () => {
      const onViewModeChange = vi.fn();
      render(<CVToolbar {...defaultProps} onViewModeChange={onViewModeChange} viewMode="formatted" />);

      // Le bouton affiche "Code" quand on est en mode formatted
      const button = screen.getByRole('button', { name: /Code/i });
      fireEvent.click(button);

      expect(onViewModeChange).toHaveBeenCalledWith('code');
    });
  });

  describe('Consultant Name Display', () => {
    it('should display consultantName when available', () => {
      render(<CVToolbar {...defaultProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display originalName when consultantName is null', () => {
      const cvWithoutName = { ...mockCV, consultantName: null };
      render(<CVToolbar {...defaultProps} cv={cvWithoutName} />);

      expect(screen.getByText('test-cv.pdf')).toBeInTheDocument();
    });
  });
});
