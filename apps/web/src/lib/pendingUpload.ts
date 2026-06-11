const DB_NAME = "pps-pending-upload-db";
const STORE_NAME = "uploads";
const MAX_RECORDS = 4;

type PendingUploadRecord = {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
};

const makeId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T> | T
) => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await fn(store, tx);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
    return result;
  } finally {
    db.close();
  }
};

const requestAsPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

const pruneOld = async () => {
  await withStore("readwrite", async (store) => {
    const records = (await requestAsPromise(store.getAll())) as PendingUploadRecord[];
    if (records.length <= MAX_RECORDS) return;
    records.sort((a, b) => a.createdAt - b.createdAt);
    const remove = records.slice(0, records.length - MAX_RECORDS);
    for (const item of remove) {
      store.delete(item.id);
    }
  });
};

export const savePendingUpload = async (dataUrl: string, name?: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const id = makeId();
  const record: PendingUploadRecord = {
    id,
    name: name ?? "upload-image",
    blob,
    createdAt: Date.now()
  };
  await withStore("readwrite", async (store) => {
    store.put(record);
  });
  await pruneOld();
  return { id, name: record.name };
};

// NOTE: this reads but does NOT delete the record. Deleting on read makes the load non-idempotent,
// which breaks under React StrictMode's double-invoke (the first run deletes the record, the second
// finds nothing and no image loads). Old records are cleaned up by pruneOld() on the next save.
export const loadPendingUpload = async (id: string) =>
  withStore("readonly", async (store) => {
    const record = (await requestAsPromise(store.get(id))) as PendingUploadRecord | undefined;
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      objectUrl: URL.createObjectURL(record.blob)
    };
  });

