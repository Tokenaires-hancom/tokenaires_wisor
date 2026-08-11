import type { CharacterMood } from "@/content/characters";
import type { Exercise } from "@/content/curriculum/types";

export type MoodInput = {
  stepKind: "read" | "exercise" | "summary";
  exerciseKind?: Exercise["kind"];
  submitted?: boolean;
  correct?: boolean;
};

export function moodFor(input: MoodInput): CharacterMood {
  if (input.stepKind === "summary") return "aha";
  if (input.stepKind === "read") return "guide";
  if (!input.submitted) return "guide";
  if (input.exerciseKind !== "graded") return "proud";
  return input.correct ? "great" : "nope";
}
