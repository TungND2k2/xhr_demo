import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionSlug } from "payload";

/**
 * Auto-sync Media.linkedRecords ← các collection sở hữu file.
 *
 * Khi 1 doc (Contract, Worker, Order...) save có field upload → 1 Media,
 * helper này tự thêm `{ relationTo: ownerSlug, value: docId }` vào
 * `linkedRecords` của Media đó. Nếu media bị bỏ link → cũng tự rút.
 *
 * Mục đích: nhìn vào 1 Media (vd PDF HĐ) biết ngay nó thuộc record nào,
 * không phải mò ngược qua tất cả collection.
 *
 * Usage trong collection definition:
 *   hooks: {
 *     afterChange: [makeSyncMediaBacklinks({ ownerSlug: "contracts", extract: (doc) => [
 *       doc.contractFile, doc.visaFile, doc.coeFile,
 *       ...(doc.payments ?? []).map((p: any) => p?.receiptFile),
 *     ]})],
 *     afterDelete: [makeRemoveAllMediaBacklinks({ ownerSlug: "contracts", extract: ... })],
 *   }
 */

type MediaRef = string | number | { id?: string | number } | null | undefined;

function extractMediaIds(refs: MediaRef[]): Set<string> {
  const ids = new Set<string>();
  for (const r of refs) {
    if (r == null) continue;
    if (typeof r === "string" || typeof r === "number") {
      ids.add(String(r));
    } else if (typeof r === "object" && r.id != null) {
      ids.add(String(r.id));
    }
  }
  return ids;
}

interface LinkRow {
  relationTo: string;
  value: string | number | { id?: string | number };
}

function linkExists(links: LinkRow[], ownerSlug: string, docId: string): boolean {
  return links.some((l) => {
    if (l.relationTo !== ownerSlug) return false;
    const vId = typeof l.value === "object" ? String(l.value?.id) : String(l.value);
    return vId === docId;
  });
}

function removeLink(links: LinkRow[], ownerSlug: string, docId: string): LinkRow[] {
  return links.filter((l) => {
    if (l.relationTo !== ownerSlug) return true;
    const vId = typeof l.value === "object" ? String(l.value?.id) : String(l.value);
    return vId !== docId;
  });
}

async function addBacklink(req: any, mediaId: string, ownerSlug: string, docId: string): Promise<void> {
  try {
    const media: any = await req.payload.findByID({
      collection: "media",
      id: mediaId,
      depth: 0,
      req,
    });
    const links: LinkRow[] = Array.isArray(media?.linkedRecords) ? media.linkedRecords : [];
    if (linkExists(links, ownerSlug, docId)) return;
    await req.payload.update({
      collection: "media",
      id: mediaId,
      data: { linkedRecords: [...links, { relationTo: ownerSlug, value: docId }] },
      depth: 0,
      overrideAccess: true,
      req,
    });
  } catch (e) {
    req.payload.logger.debug(`sync-media-backlinks: addBacklink ${ownerSlug}#${docId} → media#${mediaId} failed: ${e}`);
  }
}

async function removeBacklink(req: any, mediaId: string, ownerSlug: string, docId: string): Promise<void> {
  try {
    const media: any = await req.payload.findByID({
      collection: "media",
      id: mediaId,
      depth: 0,
      req,
    });
    const links: LinkRow[] = Array.isArray(media?.linkedRecords) ? media.linkedRecords : [];
    if (!linkExists(links, ownerSlug, docId)) return;
    await req.payload.update({
      collection: "media",
      id: mediaId,
      data: { linkedRecords: removeLink(links, ownerSlug, docId) },
      depth: 0,
      overrideAccess: true,
      req,
    });
  } catch (e) {
    req.payload.logger.debug(`sync-media-backlinks: removeBacklink ${ownerSlug}#${docId} → media#${mediaId} failed: ${e}`);
  }
}

export function makeSyncMediaBacklinks<T extends { id: string | number } & Record<string, any>>(opts: {
  ownerSlug: CollectionSlug;
  extract: (doc: T) => MediaRef[];
}): CollectionAfterChangeHook<T> {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "create" && operation !== "update") return doc;
    const docId = String((doc as any).id);
    const currentIds = extractMediaIds(opts.extract(doc));
    const prevIds = operation === "update" && previousDoc
      ? extractMediaIds(opts.extract(previousDoc as T))
      : new Set<string>();

    const toAdd: string[] = [];
    const toRemove: string[] = [];
    for (const id of currentIds) if (!prevIds.has(id)) toAdd.push(id);
    for (const id of prevIds) if (!currentIds.has(id)) toRemove.push(id);

    // Sequential — số ID/doc thường <10, không cần parallelize.
    for (const mediaId of toAdd) await addBacklink(req, mediaId, opts.ownerSlug, docId);
    for (const mediaId of toRemove) await removeBacklink(req, mediaId, opts.ownerSlug, docId);

    return doc;
  };
}

export function makeRemoveAllMediaBacklinks<T extends { id: string | number } & Record<string, any>>(opts: {
  ownerSlug: CollectionSlug;
  extract: (doc: T) => MediaRef[];
}): CollectionAfterDeleteHook<T> {
  return async ({ doc, req }) => {
    const docId = String((doc as any).id);
    const ids = extractMediaIds(opts.extract(doc));
    for (const mediaId of ids) await removeBacklink(req, mediaId, opts.ownerSlug, docId);
  };
}
