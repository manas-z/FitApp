// src/firebase/firestore/use-doc.tsx
import { useEffect, useState } from 'react';
import {
  doc,
  onSnapshot,
  type DocumentReference,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { useFirebase } from '../provider';

type DocState<T> = {
  data: (T & { id: string }) | null;
  isLoading: boolean;
  error: Error | null;
};

function getDocRef<T>(
  firestore: Firestore,
  refOrPath: string | DocumentReference<DocumentData>,
): DocumentReference<DocumentData> {
  if (typeof refOrPath === 'string') {
    return doc(firestore, refOrPath);
  }
  return refOrPath;
}

export function useDoc<T = DocumentData>(
  refOrPath: string | DocumentReference<DocumentData>,
): DocState<T> {
  const { firestore } = useFirebase();
  const [state, setState] = useState<DocState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const ref = getDocRef<T>(firestore, refOrPath);

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState({ data: null, isLoading: false, error: null });
          return;
        }
        const data = snap.data() as T;
        setState({
          data: { id: snap.id, ...data },
          isLoading: false,
          error: null,
        });
      },
      (err) => {
        console.warn('useDoc snapshot error', err);
        setState((prev) => ({ ...prev, isLoading: false, error: err }));
      },
    );

    return unsub;
  }, [firestore, refOrPath]);

  return state;
}
