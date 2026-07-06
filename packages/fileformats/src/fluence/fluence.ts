import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Document } from 'scene';

/**
 * `.fluence` — the open, versioned project format: a zip of a JSON document
 * (`document.json`) plus assets (rasters, added in M1-T09). Versioned from day
 * one with a migration hook so older files keep opening (development-plan §1.2).
 */
export const FLUENCE_FORMAT_VERSION = 1;

interface FluenceFile {
  app: 'fluence';
  formatVersion: number;
  document: Document;
}

export interface LoadedFluence {
  formatVersion: number;
  document: Document;
}

/** Serialize a document to `.fluence` bytes (zip of document.json). */
export function serializeFluence(doc: Document): Uint8Array {
  const file: FluenceFile = {
    app: 'fluence',
    formatVersion: FLUENCE_FORMAT_VERSION,
    document: doc,
  };
  return zipSync({ 'document.json': strToU8(JSON.stringify(file)) }, { level: 6 });
}

/** Parse `.fluence` bytes back into a document, migrating older versions. */
export function deserializeFluence(data: Uint8Array): LoadedFluence {
  const entries = unzipSync(data);
  const docEntry = entries['document.json'];
  if (!docEntry) throw new Error('Not a .fluence file: document.json is missing');

  const raw = JSON.parse(strFromU8(docEntry)) as Partial<FluenceFile>;
  if (raw.app !== 'fluence' || typeof raw.formatVersion !== 'number' || !raw.document) {
    throw new Error('Not a valid .fluence file');
  }

  const migrated = migrate(raw as FluenceFile);
  return { formatVersion: migrated.formatVersion, document: migrated.document };
}

/** Upgrade older documents to the current schema. v1 is current. */
function migrate(file: FluenceFile): FluenceFile {
  if (file.formatVersion > FLUENCE_FORMAT_VERSION) {
    throw new Error(
      `.fluence v${file.formatVersion} is newer than supported (v${FLUENCE_FORMAT_VERSION}); please update Fluence`,
    );
  }
  // Future: if (file.formatVersion < N) file = upgradeToN(file);
  return { ...file, formatVersion: FLUENCE_FORMAT_VERSION };
}
