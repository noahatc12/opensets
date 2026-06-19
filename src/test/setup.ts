// Vitest global setup. Import fake-indexeddb BEFORE Dexie loads so DB tests and
// useLiveQuery have a working IndexedDB in the node test environment (spec §13).
import 'fake-indexeddb/auto';
