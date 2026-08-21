import { Annotation, EditorPage, SourceDocument } from "./editorTypes";

const DATABASE = "pdf-edit-studio-sessions";
const STORE = "sessions";
const LIBRARY_STORE = "library";
const KEY = "active";

export type RecoveredSession = { sources: SourceDocument[]; pages: EditorPage[]; annotations: Annotation[]; fileName: string; savedAt: number };
export type LibraryDocument = RecoveredSession & { id: string };
export type LibraryDocumentSummary = Pick<LibraryDocument, "id" | "fileName" | "pages" | "sources" | "savedAt">;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      if (!request.result.objectStoreNames.contains(LIBRARY_STORE)) request.result.createObjectStore(LIBRARY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveEditorSession(session: RecoveredSession) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE, "readwrite").objectStore(STORE).put(session, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export async function loadEditorSession(): Promise<RecoveredSession | null> {
  const database = await openDatabase();
  const result = await new Promise<RecoveredSession | null>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

export async function clearEditorSession() {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export async function saveLibraryDocument(document: LibraryDocument) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(LIBRARY_STORE, "readwrite").objectStore(LIBRARY_STORE).put(document);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export async function listLibraryDocuments(): Promise<LibraryDocumentSummary[]> {
  const database = await openDatabase();
  const results = await new Promise<LibraryDocument[]>((resolve, reject) => {
    const request = database.transaction(LIBRARY_STORE, "readonly").objectStore(LIBRARY_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return results.sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadLibraryDocument(id: string): Promise<LibraryDocument | null> {
  const database = await openDatabase();
  const result = await new Promise<LibraryDocument | null>((resolve, reject) => {
    const request = database.transaction(LIBRARY_STORE, "readonly").objectStore(LIBRARY_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

export async function renameLibraryDocument(id: string, fileName: string) {
  const document = await loadLibraryDocument(id);
  if (!document) throw new Error("Saved document not found.");
  await saveLibraryDocument({ ...document, fileName, savedAt: Date.now() });
}

export async function deleteLibraryDocument(id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(LIBRARY_STORE, "readwrite").objectStore(LIBRARY_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}
