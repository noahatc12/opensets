/**
 * Single source of UI copy (spec refinement: route all strings through one module
 * from P1 — started here so it never needs retrofitting). Actual translations
 * (Spanish first) land in P4; for now this is the English string table and the
 * `t()` accessor everything reads through.
 */
export const strings = {
  app: {
    name: 'OpenSets',
    tagline: 'Strength training that tells you when to add weight.',
  },
  nav: {
    today: 'Today',
    library: 'Library',
    history: 'History',
    settings: 'Settings',
  },
  today: {
    title: 'Today',
    emptyTitle: 'No workout yet',
    emptyBody:
      'OpenSets builds your plan, tracks every set, and computes when to add weight — all on your device, fully offline. Workout logging arrives in the next update.',
    disclaimer: 'Educational tool — not medical advice.',
  },
  library: {
    title: 'Library',
    emptyTitle: 'Exercise library, coming soon',
    emptyBody:
      '873 public-domain exercises with images, instructions, and worked muscles are bundled. Browse and search arrive with logging in the next update.',
  },
  history: {
    title: 'History',
    emptyTitle: 'No history yet',
    emptyBody: 'Your logged workouts, PRs, and e1RM trends will appear here.',
  },
  settings: {
    title: 'Settings',
    units: 'Units',
    unitsHint:
      'Loads are always stored in kilograms; this changes display only.',
    storage: 'On-device storage',
    storagePersisted: 'Persistent — the browser will not evict your data.',
    storageBestEffort:
      'Best-effort — install to the home screen and grant persistence to protect your history.',
    requestPersist: 'Request persistent storage',
    usage: 'Used',
    data: 'Your data',
    export: 'Export backup',
    exportHint: 'Download your entire database as a JSON file.',
    import: 'Import backup',
    importHint: 'Restore from a backup file. This replaces current data.',
    about: 'About',
    privacy:
      'Your data never leaves your device. No accounts, no servers, no tracking.',
    disclaimer:
      'Educational tool — not medical advice. Consult a professional.',
  },
} as const;

/** Convenience accessor. Kept tiny now; gains locale routing in P4. */
export const t = strings;
