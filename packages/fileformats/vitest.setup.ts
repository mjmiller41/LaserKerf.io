// Patch a spec-compliant in-memory IndexedDB onto globalThis for the MetaStore
// tests. OPFS is injected per-test via MemoryDirectoryHandle instead.
import 'fake-indexeddb/auto';
