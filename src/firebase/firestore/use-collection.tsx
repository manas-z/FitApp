// src/firebase/firestore/use-collection.tsx
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query as makeQuery,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore';
import { useFirebase } from '../provider';

type CollectionState<T> = {
  data: (T & { id: string })[];
  isLoading: boolean;
  error: Error | null;
};

/**
 * Simple collection hook:
 *   useCollection<Schedule>('users/USER_ID/schedules')
 * or
 *   useCollection<Schedule>('schedules', [where('ownerId', '==', uid)])
 */
export function useCollection<T = DocumentData>(
  path: string,
  constraints: QueryConstraint[] = [],
): CollectionState<T> {
  const { firestore } = useFirebase();
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const baseRef = collection(firestore, path);
    const q = constraints.length
      ? makeQuery(baseRef, ...constraints)
      : baseRef;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as T),
        }));
        setState({ data: items, isLoading: false, error: null });
      },
      (err) => {
        console.warn('useCollection snapshot error', err);
        setState((prev) => ({ ...prev, isLoading: false, error: err }));
      },
    );

    return unsub;
  }, [firestore, path, JSON.stringify(constraints)]);

  return state;
}
