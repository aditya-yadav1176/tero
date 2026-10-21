import type { HistoryItem } from '../types';

const DB_NAME = 'tero_handwriting_db';
const DB_VERSION = 1;
const STORE_NAME = 'history_items';
const LEGACY_STORAGE_KEY = 'tero_recognition_history_v1';

let dbPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported by this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('split', 'split', { unique: false });
      }
    };

    request.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Perform one-time migration from legacy localStorage if present
      await migrateFromLocalStorage(db);
      resolve(db);
    };

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };
  });

  return dbPromise;
}

async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    const legacyItems: HistoryItem[] = JSON.parse(raw);
    if (Array.isArray(legacyItems) && legacyItems.length > 0) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of legacyItems) {
        store.put(item);
      }
      // Clear legacy storage after successful migration
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.info(`[IndexedDB] Migrated ${legacyItems.length} legacy items from localStorage into IndexedDB.`);
    }
  } catch (err) {
    console.warn('[IndexedDB] Legacy migration check failed:', err);
  }
}

export async function idbSaveItem(item: HistoryItem): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetItems(maxCount?: number): Promise<HistoryItem[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    // Open cursor in descending order ('prev') to get newest first
    const req = index.openCursor(null, 'prev');
    const items: HistoryItem[] = [];

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && (!maxCount || items.length < maxCount)) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };

    req.onerror = () => reject(req.error);
  });
}

export async function idbGetItem(id: string): Promise<HistoryItem | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteItem(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbBulkImport(items: HistoryItem[]): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let imported = 0;

    for (const item of items) {
      if (item && item.id && item.predicted_text) {
        store.put(item);
        imported++;
      }
    }

    tx.oncomplete = () => resolve(imported);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClearAll(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

