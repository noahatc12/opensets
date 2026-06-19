import { ulid } from 'ulid';

/**
 * Lexicographically-sortable, time-ordered unique id (spec §8: ULIDs).
 * Lives in the db layer — uses the clock + randomness, which the pure engine
 * must never do.
 */
export function newId(): string {
  return ulid();
}
