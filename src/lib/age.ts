/** Whole years between an ISO birth date (yyyy-mm-dd) and `nowIso`, or undefined when
 *  the date is missing or unparseable. The caller passes `now` (never read the clock
 *  in the engine). */
export function ageFromBirthDate(
  birthDate: string | undefined,
  nowIso: string,
): number | undefined {
  if (!birthDate) return undefined;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ny, nm, nd] = nowIso.slice(0, 10).split('-').map(Number);
  if (!by || !bm || !bd || !ny || !nm || !nd) return undefined;
  const hadBirthday = nm > bm || (nm === bm && nd >= bd);
  const age = ny - by - (hadBirthday ? 0 : 1);
  return age >= 0 ? age : undefined;
}
