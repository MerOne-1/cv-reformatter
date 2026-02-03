import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'code' | 'formatted';

interface UIStore {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Editor
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;

  // Modals
  previewModalOpen: boolean;
  notesDialogOpen: boolean;
  setPreviewModalOpen: (open: boolean) => void;
  setNotesDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      // Editor
      viewMode: 'code' as ViewMode,
      setViewMode: (viewMode) => set({ viewMode }),
      toggleViewMode: () =>
        set({ viewMode: get().viewMode === 'code' ? 'formatted' : 'code' }),

      // Modals
      previewModalOpen: false,
      notesDialogOpen: false,
      setPreviewModalOpen: (previewModalOpen) => set({ previewModalOpen }),
      setNotesDialogOpen: (notesDialogOpen) => set({ notesDialogOpen }),
    }),
    {
      name: 'cv-reformatter-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        viewMode: state.viewMode,
      }),
    }
  )
);

// Selectors
export const useSidebarCollapsed = () => useUIStore((state) => state.sidebarCollapsed);
export const useViewMode = () => useUIStore((state) => state.viewMode);
export const usePreviewModalOpen = () => useUIStore((state) => state.previewModalOpen);
export const useNotesDialogOpen = () => useUIStore((state) => state.notesDialogOpen);
