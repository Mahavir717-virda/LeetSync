/**
 * LeetSync Label Resolver
 *
 * Ensures that every solution label is unique within its language group.
 * If a user picks "Optimal" but "optimal.cpp" already exists, this module
 * auto-proposes "Optimal v2" — surfacing the conflict in the UI before commit.
 */

import type { Solution } from '@/types';

// ─── Core Resolution ───────────────────────────────────────────────────────────

/**
 * Ensure a desired label is unique within the existing solutions for a language.
 *
 * Algorithm:
 *  1. Normalize both desired and existing labels to lowercase for comparison.
 *  2. If no collision → return the desired label unchanged.
 *  3. On collision → append " v2", " v3", etc. until a unique variant is found.
 *  4. Hard cap at v99 (should never be reached in practice).
 *
 * Examples:
 *  resolveUniqueLabel("Optimal", ["Default", "Brute Force"])  → "Optimal"
 *  resolveUniqueLabel("Optimal", ["Default", "Optimal"])      → "Optimal v2"
 *  resolveUniqueLabel("Optimal", ["Default", "Optimal", "Optimal v2"]) → "Optimal v3"
 */
export function resolveUniqueLabel(
  desiredLabel: string,
  existingSolutions: Solution[]
): string {
  const existingNormalized = new Set(
    existingSolutions.map((s) => s.label.toLowerCase().trim())
  );

  const normalized = desiredLabel.toLowerCase().trim();

  if (!existingNormalized.has(normalized)) {
    return desiredLabel; // No collision — use as-is
  }

  // Collision — increment suffix until unique
  for (let v = 2; v <= 99; v++) {
    const candidate = `${desiredLabel} v${v}`;
    if (!existingNormalized.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Emergency fallback — practically unreachable
  return `${desiredLabel}-${Date.now()}`;
}

// ─── UI Validation Helpers ────────────────────────────────────────────────────

/**
 * Check whether a given label already exists in the provided solutions list.
 * Used by the ConflictDialog to show a real-time warning chip as the user types.
 *
 * Returns:
 *  { isDuplicate: false }                  — label is free to use
 *  { isDuplicate: true, suggestion: "Optimal v2" }  — collision detected
 */
export function checkLabelConflict(
  desiredLabel: string,
  existingSolutions: Solution[]
): { isDuplicate: boolean; suggestion?: string } {
  const normalized = desiredLabel.toLowerCase().trim();
  const existingNormalized = existingSolutions.map((s) =>
    s.label.toLowerCase().trim()
  );

  if (!existingNormalized.includes(normalized)) {
    return { isDuplicate: false };
  }

  const suggestion = resolveUniqueLabel(desiredLabel, existingSolutions);
  return { isDuplicate: true, suggestion };
}

/**
 * Validate that a custom label entered by the user is safe to use as a filename.
 * Returns an error message string, or null if valid.
 *
 * Rules:
 *  - Must be between 1 and 40 characters.
 *  - Must not be the reserved word "Default".
 *  - Must not contain path separators or characters invalid in filenames.
 */
export function validateCustomLabel(label: string): string | null {
  const trimmed = label.trim();

  if (!trimmed) {
    return 'Label cannot be empty.';
  }
  if (trimmed.length > 40) {
    return 'Label must be 40 characters or fewer.';
  }
  if (trimmed.toLowerCase() === 'default') {
    return '"Default" is reserved. Choose a different name.';
  }
  if (/[/\\:*?"<>|]/.test(trimmed)) {
    return 'Label contains invalid characters ( / \\ : * ? " < > | ).';
  }

  return null; // Valid
}
