import { create } from "zustand";
import { localDateIso } from "@/lib/utils";

interface UiState {
  activeWorkoutDate: string;
  setActiveWorkoutDate: (dateIso: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeWorkoutDate: localDateIso(new Date()),
  setActiveWorkoutDate: (activeWorkoutDate) => set({ activeWorkoutDate })
}));
