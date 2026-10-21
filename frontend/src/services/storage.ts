import type { HistoryItem, DatasetSplit } from '../types';
import { db, checkFirebaseConfig, ensureAuthenticated } from './firebase';
import {
  idbSaveItem,
  idbGetItems,
  idbGetItem,
  idbDeleteItem,
  idbBulkImport,
} from './indexedDb';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let devId = localStorage.getItem('tero_device_id');
  if (!devId) {
    devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('tero_device_id', devId);
  }
  return devId;
}

export async function saveRecognitionAttempt(
  data: Omit<HistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<HistoryItem> {
  const id = data.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = data.timestamp || Date.now();
  const split: DatasetSplit = data.split || (Math.random() < 0.2 ? 'test' : 'train');
  const myDeviceId = getDeviceId();

  const savedItem: HistoryItem = {
    id,
    image_data: data.image_data,
    predicted_text: data.predicted_text,
    corrected_text: data.corrected_text || data.predicted_text,
    is_correct: data.is_correct ?? null,
    status: data.status || 'unreviewed',
    timestamp,
    model_version: data.model_version,
    inference_time_ms: data.inference_time_ms,
    split,
    originating_device_id: myDeviceId,
    has_local_image: !!data.image_data,
  };

  // 1. Always save full record with image in local IndexedDB (zero-cost, survives refresh)
  await idbSaveItem(savedItem);

  // 2. If Firebase Firestore is configured on Spark free tier, sync metadata
  const configStatus = checkFirebaseConfig();
  if (configStatus.isConfigured && db) {
    try {
      await ensureAuthenticated();
      const docPayload = {
        id,
        createdAt: new Date(timestamp).toISOString(),
        timestamp,
        predictedText: data.predicted_text,
        correctedText: data.corrected_text || data.predicted_text,
        isCorrect: data.is_correct ?? null,
        sampleStatus: data.status || 'unreviewed',
        modelVersion: data.model_version,
        inferenceTimeMs: data.inference_time_ms || 0,
        split,
        originatingDeviceId: myDeviceId,
      };

      await setDoc(doc(db, 'recognition_attempts', id), docPayload);
    } catch (cloudErr) {
      console.warn('[Storage] Firestore cloud sync skipped/failed:', cloudErr);
    }
  }

  return savedItem;
}

export async function updateHistoryItem(
  id: string,
  updates: Partial<Pick<HistoryItem, 'corrected_text' | 'is_correct' | 'status' | 'split'>>
): Promise<void> {
  // Update local IndexedDB
  const local = await idbGetItem(id);
  if (local) {
    const updated: HistoryItem = {
      ...local,
      ...updates,
    };
    await idbSaveItem(updated);
  }

  // Update Cloud Firestore if configured
  const configStatus = checkFirebaseConfig();
  if (configStatus.isConfigured && db) {
    try {
      await ensureAuthenticated();
      const docRef = doc(db, 'recognition_attempts', id);
      await setDoc(
        docRef,
        {
          ...(updates.corrected_text !== undefined ? { correctedText: updates.corrected_text } : {}),
          ...(updates.is_correct !== undefined ? { isCorrect: updates.is_correct } : {}),
          ...(updates.status !== undefined ? { sampleStatus: updates.status } : {}),
          ...(updates.split !== undefined ? { split: updates.split } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (cloudErr) {
      console.warn('[Storage] Firestore cloud update skipped/failed:', cloudErr);
    }
  }
}

export async function fetchHistory(
  maxCount: number = 50
): Promise<{ items: HistoryItem[]; isCloud: boolean }> {
  const configStatus = checkFirebaseConfig();

  // Try Cloud Firestore if configured
  if (configStatus.isConfigured && db) {
    try {
      await ensureAuthenticated();
      const attemptsRef = collection(db, 'recognition_attempts');
      const q = query(attemptsRef, orderBy('timestamp', 'desc'), limit(maxCount));
      const querySnapshot = await getDocs(q);

      const items: HistoryItem[] = [];
      for (const docSnap of querySnapshot.docs) {
        const d = docSnap.data();
        const id = docSnap.id;

        // Check if this device has the local image stored in IndexedDB
        const localItem = await idbGetItem(id);
        const hasLocalImage = !!localItem?.image_data;

        items.push({
          id,
          image_data: localItem?.image_data || '',
          predicted_text: d.predictedText || '',
          corrected_text: d.correctedText || d.predictedText || '',
          is_correct: d.isCorrect ?? null,
          status: d.sampleStatus || 'unreviewed',
          timestamp: d.timestamp || (d.createdAt ? new Date(d.createdAt).getTime() : Date.now()),
          model_version: d.modelVersion || 'microsoft/trocr-base-handwritten',
          inference_time_ms: d.inferenceTimeMs,
          split: d.split || 'train',
          originating_device_id: d.originatingDeviceId || '',
          has_local_image: hasLocalImage,
        });
      }

      return { items, isCloud: true };
    } catch (cloudErr) {
      console.warn('[Storage] Firestore fetch failed, falling back to local IndexedDB:', cloudErr);
    }
  }

  // Fallback to local IndexedDB
  const localItems = await idbGetItems(maxCount);
  return { items: localItems, isCloud: false };
}

export function subscribeToHistoryUpdates(
  callback: (items: HistoryItem[], isCloud: boolean) => void,
  maxCount: number = 50
): () => void {
  const configStatus = checkFirebaseConfig();

  if (configStatus.isConfigured && db) {
    try {
      const attemptsRef = collection(db, 'recognition_attempts');
      const q = query(attemptsRef, orderBy('timestamp', 'desc'), limit(maxCount));

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const items: HistoryItem[] = [];
          for (const docSnap of snapshot.docs) {
            const d = docSnap.data();
            const id = docSnap.id;
            const localItem = await idbGetItem(id);

            items.push({
              id,
              image_data: localItem?.image_data || '',
              predicted_text: d.predictedText || '',
              corrected_text: d.correctedText || d.predictedText || '',
              is_correct: d.isCorrect ?? null,
              status: d.sampleStatus || 'unreviewed',
              timestamp: d.timestamp || (d.createdAt ? new Date(d.createdAt).getTime() : Date.now()),
              model_version: d.modelVersion || 'microsoft/trocr-base-handwritten',
              inference_time_ms: d.inferenceTimeMs,
              split: d.split || 'train',
              originating_device_id: d.originatingDeviceId || '',
              has_local_image: !!localItem?.image_data,
            });
          }
          callback(items, true);
        },
        async (error) => {
          console.warn('[Storage] Firestore realtime subscription error, using IndexedDB:', error);
          const localItems = await idbGetItems(maxCount);
          callback(localItems, false);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[Storage] Unable to setup Firestore listener:', err);
    }
  }

  // Local mode: initial query
  idbGetItems(maxCount).then((localItems) => callback(localItems, false));
  return () => {};
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await idbDeleteItem(id);

  const configStatus = checkFirebaseConfig();
  if (configStatus.isConfigured && db) {
    try {
      await ensureAuthenticated();
      await deleteDoc(doc(db, 'recognition_attempts', id));
    } catch (cloudErr) {
      console.warn('[Storage] Firestore deleteDoc error:', cloudErr);
    }
  }
}

export async function fetchEvaluationStats(): Promise<{
  totalSamples: number;
  correctCount: number;
  accuracy: number;
  trainCount: number;
  testCount: number;
  samples: HistoryItem[];
  isCloud: boolean;
}> {
  const { items, isCloud } = await fetchHistory(500);

  // Evaluated samples are those reviewed by user (is_correct !== null)
  const evaluatedSamples = items.filter((item) => item.is_correct !== null);
  const totalSamples = evaluatedSamples.length;
  const correctCount = evaluatedSamples.filter((item) => item.is_correct === true).length;
  const accuracy = totalSamples > 0 ? (correctCount / totalSamples) * 100 : 0;

  const trainCount = evaluatedSamples.filter((s) => s.split === 'train').length;
  const testCount = evaluatedSamples.filter((s) => s.split === 'test').length;

  return {
    totalSamples,
    correctCount,
    accuracy: Math.round(accuracy * 10) / 10,
    trainCount,
    testCount,
    samples: evaluatedSamples,
    isCloud,
  };
}

export async function importDataset(jsonData: any): Promise<number> {
  const rawList = Array.isArray(jsonData)
    ? jsonData
    : Array.isArray(jsonData.samples)
    ? jsonData.samples
    : [];

  if (rawList.length === 0) {
    throw new Error('No valid samples found in dataset JSON.');
  }

  const itemsToImport: HistoryItem[] = rawList.map((item: any, idx: number) => ({
    id: item.id || `imp_${Date.now()}_${idx}`,
    image_data: item.image_data || item.image || '',
    predicted_text: item.predicted_text || item.predicted || '',
    corrected_text: item.corrected_text || item.ground_truth || item.predicted_text || '',
    is_correct: typeof item.is_correct === 'boolean' ? item.is_correct : null,
    status: item.status || 'unreviewed',
    timestamp: item.timestamp || Date.now(),
    model_version: item.model_version || 'microsoft/trocr-base-handwritten',
    inference_time_ms: item.inference_time_ms,
    split: item.split || (idx % 5 === 0 ? 'test' : 'train'),
    originating_device_id: getDeviceId(),
    has_local_image: !!(item.image_data || item.image),
  }));

  const count = await idbBulkImport(itemsToImport);
  return count;
}
