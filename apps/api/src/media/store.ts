/** Accepted final keys are immutable. A single R2 read streams their atomic body. */
export async function readAcceptedBody(
  bucket: Pick<R2Bucket, "get">,
  key: string,
): Promise<ReadableStream<Uint8Array> | null> {
  return (await bucket.get(key))?.body ?? null;
}

export type StoredObject = {
  etag: string;
  bytes: Uint8Array;
};

export type ObjectGet = {
  etag: string;
  size: number;
  bytes: Uint8Array | null;
  preconditionFailed: boolean;
};

export type ObjectStore = {
  head(key: string): Promise<{ etag: string; size: number } | null>;
  get(
    key: string,
    options: { etagMatches: string; maxBytes: number },
  ): Promise<ObjectGet | null>;
  put(
    key: string,
    bytes: Uint8Array,
    options: { contentType: string; ifNoneMatch: boolean },
  ): Promise<{ etag: string } | null>;
  delete(key: string): Promise<void>;
};

export function memoryObjectStore(): ObjectStore & {
  puts: number;
  objects: Map<string, StoredObject>;
} {
  const objects = new Map<string, StoredObject>();
  let puts = 0;
  return {
    objects,
    get puts() {
      return puts;
    },
    async head(key) {
      const object = objects.get(key);
      if (!object) {
        return null;
      }
      return { etag: object.etag, size: object.bytes.byteLength };
    },
    async get(key, options) {
      const object = objects.get(key);
      if (!object) {
        return null;
      }
      if (object.etag !== options.etagMatches) {
        return {
          etag: object.etag,
          size: object.bytes.byteLength,
          bytes: null,
          preconditionFailed: true,
        };
      }
      const size = object.bytes.byteLength;
      if (size > options.maxBytes) {
        return { etag: object.etag, size, bytes: null, preconditionFailed: false };
      }
      return {
        etag: object.etag,
        size,
        bytes: object.bytes.slice(),
        preconditionFailed: false,
      };
    },
    async put(key, bytes, options) {
      if (options.ifNoneMatch && objects.has(key)) {
        return null;
      }
      const etag = await etagOf(bytes);
      objects.set(key, { etag, bytes: bytes.slice() });
      puts += 1;
      return { etag };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

export function r2ObjectStore(bucket: R2Bucket): ObjectStore {
  return {
    async head(key) {
      const object = await bucket.head(key);
      if (!object) {
        return null;
      }
      return { etag: object.etag, size: object.size };
    },
    async get(key, options) {
      const object = await bucket.get(key, {
        onlyIf: { etagMatches: options.etagMatches },
        range: { offset: 0, length: options.maxBytes },
      });
      if (!object) {
        return null;
      }
      if (!("body" in object) || !object.body) {
        return {
          etag: object.etag,
          size: object.size,
          bytes: null,
          preconditionFailed: true,
        };
      }
      return {
        etag: object.etag,
        size: object.size,
        bytes: new Uint8Array(await object.arrayBuffer()),
        preconditionFailed: false,
      };
    },
    async put(key, bytes, options) {
      const stored = await bucket.put(key, bytes, {
        onlyIf: options.ifNoneMatch ? new Headers({ "If-None-Match": "*" }) : undefined,
        httpMetadata: { contentType: options.contentType },
      });
      if (!stored) {
        return null;
      }
      return { etag: stored.etag };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

async function etagOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", bytes.slice().buffer);
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}
