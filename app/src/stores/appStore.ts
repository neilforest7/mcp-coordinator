import { create } from 'zustand';

interface AppState {
  selectedMachineId: string | null;
  activeTab: "claude" | "opencode";
  setSelectedMachineId: (id: string | null) => void;
  setActiveTab: (tab: "claude" | "opencode") => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedMachineId: "local",
  activeTab: "claude",
  setSelectedMachineId: (id) => set({ selectedMachineId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
