/**
 * Set collapsing utility
 *
 * Collapses consecutive identical sets into summary groups.
 * Example: [{reps:8, weight:17.5}, {reps:8, weight:17.5}, {reps:6, weight:20}]
 * →  [{count:2, reps:8, weight:17.5}, {count:1, reps:6, weight:20}]
 *
 * Rules:
 * - Two sets are "identical" when both reps and weight match exactly.
 * - Non-consecutive identical sets are NOT merged (preserves workout progression).
 */

export interface SetLike {
  reps: number;
  weight: number;
}

export interface CollapsedGroup {
  count: number;
  reps: number;
  weight: number;
}

export function collapseSetGroups(sets: SetLike[]): CollapsedGroup[] {
  if (!sets || sets.length === 0) return [];

  const groups: CollapsedGroup[] = [];
  let current: CollapsedGroup = { count: 1, reps: sets[0].reps, weight: sets[0].weight };

  for (let i = 1; i < sets.length; i++) {
    const s = sets[i];
    if (s.reps === current.reps && s.weight === current.weight) {
      current.count++;
    } else {
      groups.push(current);
      current = { count: 1, reps: s.reps, weight: s.weight };
    }
  }
  groups.push(current);
  return groups;
}

/**
 * Formats a collapsed group list as a concise inline string.
 * Example: "3 × 8 @ 17.5 kg, 2 × 6 @ 20 kg"
 */
export function formatCollapsedSets(groups: CollapsedGroup[]): string {
  return groups
    .map((g) =>
      g.count > 1
        ? `${g.count} × ${g.reps} @ ${g.weight} kg`
        : `${g.reps} @ ${g.weight} kg`
    )
    .join(", ");
}
