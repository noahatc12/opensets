import { useEffect, useState } from 'react';
import { loadCatalog } from '../../db/catalog';
import type { Exercise } from '../../db/types';

/** Load the bundled exercise catalog once; null while loading. */
export function useCatalog(): Exercise[] | null {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((list) => live && setExercises(list))
      .catch(() => live && setExercises([]));
    return () => {
      live = false;
    };
  }, []);
  return exercises;
}
