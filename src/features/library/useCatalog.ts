import { useEffect, useState } from 'react';
import { loadCatalog } from '../../db/catalog';
import { loadSearchIndex, type SearchIndex } from '../../db/searchIndex';
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

/** Load the prebuilt FlexSearch index once; null while loading (callers fall
 *  back to a name substring filter so search is never dead during the load). */
export function useSearchIndex(): SearchIndex | null {
  const [index, setIndex] = useState<SearchIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadSearchIndex()
      .then((doc) => live && setIndex(doc))
      .catch(() => live && setIndex(null));
    return () => {
      live = false;
    };
  }, []);
  return index;
}
