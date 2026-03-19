import { create } from "zustand";
import { localDateIso } from "@/lib/utils";

interface UiState {
  selectedDate: string;
  activeWorkoutId: string | null;
  setSelectedDate: (dateIso: string) => void;
  setActiveWorkoutId: (workoutId: string | null) => void;
  clearActiveWorkout: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedDate: localDateIso(new Date()),
  activeWorkoutId: null,
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setActiveWorkoutId: (activeWorkoutId) => set({ activeWorkoutId }),
  clearActiveWorkout: () => set({ activeWorkoutId: null })
}));
