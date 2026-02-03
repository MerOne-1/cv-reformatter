import { create } from 'zustand';
import { CVWithImprovementsAndAudio } from '@/lib/types';

interface CVStore {
  // State
  selectedCV: CVWithImprovementsAndAudio | null;
  markdown: string;
  templateName: string;
  notes: string;
  futureMissionNotes: string;

  // Derived state helpers
  isEditing: boolean;
  hasUnsavedChanges: boolean;

  // Actions
  selectCV: (cv: CVWithImprovementsAndAudio | null) => void;
  setMarkdown: (markdown: string) => void;
  setTemplateName: (name: string) => void;
  setNotes: (notes: string) => void;
  setFutureMissionNotes: (notes: string) => void;
  updateSelectedCV: (updates: Partial<CVWithImprovementsAndAudio>) => void;
  markAsSaved: () => void;
  reset: () => void;
}

const initialState = {
  selectedCV: null,
  markdown: '',
  templateName: 'default',
  notes: '',
  futureMissionNotes: '',
  isEditing: false,
  hasUnsavedChanges: false,
};

export const useCVStore = create<CVStore>((set, get) => ({
  ...initialState,

  selectCV: (cv) => {
    set({
      selectedCV: cv,
      markdown: cv?.markdownContent || '',
      templateName: cv?.templateName || 'default',
      notes: cv?.notes || '',
      futureMissionNotes: cv?.futureMissionNotes || '',
      isEditing: !!cv,
      hasUnsavedChanges: false,
    });
  },

  setMarkdown: (markdown) => {
    const { selectedCV } = get();
    const hasChanged = markdown !== selectedCV?.markdownContent;
    set({ markdown, hasUnsavedChanges: hasChanged });
  },

  setTemplateName: (templateName) => {
    const { selectedCV } = get();
    const hasChanged = templateName !== selectedCV?.templateName;
    set({ templateName, hasUnsavedChanges: hasChanged || get().hasUnsavedChanges });
  },

  setNotes: (notes) => {
    const { selectedCV } = get();
    const hasChanged = notes !== (selectedCV?.notes || '');
    set({ notes, hasUnsavedChanges: hasChanged || get().hasUnsavedChanges });
  },

  setFutureMissionNotes: (futureMissionNotes) => {
    const { selectedCV } = get();
    const hasChanged = futureMissionNotes !== (selectedCV?.futureMissionNotes || '');
    set({ futureMissionNotes, hasUnsavedChanges: hasChanged || get().hasUnsavedChanges });
  },

  updateSelectedCV: (updates) => {
    const { selectedCV } = get();
    if (!selectedCV) return;

    const updatedCV = { ...selectedCV, ...updates };
    set({
      selectedCV: updatedCV,
      markdown: updates.markdownContent ?? get().markdown,
      templateName: updates.templateName ?? get().templateName,
      notes: updates.notes ?? get().notes,
      futureMissionNotes: updates.futureMissionNotes ?? get().futureMissionNotes,
    });
  },

  markAsSaved: () => {
    set({ hasUnsavedChanges: false });
  },

  reset: () => {
    set(initialState);
  },
}));

// Selectors for optimized re-renders
export const useSelectedCV = () => useCVStore((state) => state.selectedCV);
export const useMarkdown = () => useCVStore((state) => state.markdown);
export const useTemplateName = () => useCVStore((state) => state.templateName);
export const useNotes = () => useCVStore((state) => state.notes);
export const useFutureMissionNotes = () => useCVStore((state) => state.futureMissionNotes);
export const useHasUnsavedChanges = () => useCVStore((state) => state.hasUnsavedChanges);
