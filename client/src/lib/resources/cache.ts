type CacheEntry<T> = {
  data?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

type ReadCachedResourceOptions = {
  ttlMs?: number;
  forceRefresh?: boolean;
};

const resourceCache = new Map<string, CacheEntry<unknown>>();

export function peekCachedResource<T>(key: string): T | undefined {
  const cached = resourceCache.get(key) as CacheEntry<T> | undefined;

  if (!cached || cached.data === undefined || cached.expiresAt <= Date.now()) {
    return undefined;
  }

  return cached.data;
}

export async function readCachedResource<T>(
  key: string,
  loader: () => Promise<T>,
  options: ReadCachedResourceOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 15_000;
  const forceRefresh = options.forceRefresh ?? false;
  const now = Date.now();
  const cached = resourceCache.get(key) as CacheEntry<T> | undefined;

  if (!forceRefresh) {
    if (cached?.data !== undefined && cached.expiresAt > now) {
      return cached.data;
    }

    if (cached?.promise) {
      return cached.promise;
    }
  }

  const pendingPromise = loader().then((data) => {
    resourceCache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });

    return data;
  }).catch((reason) => {
    const current = resourceCache.get(key) as CacheEntry<T> | undefined;

    if (current?.promise === pendingPromise) {
      if (cached?.data !== undefined && cached.expiresAt > Date.now()) {
        resourceCache.set(key, {
          data: cached.data,
          expiresAt: cached.expiresAt,
        });
      } else {
        resourceCache.delete(key);
      }
    }

    throw reason;
  });

  resourceCache.set(key, {
    data: forceRefresh ? undefined : cached?.data,
    expiresAt: forceRefresh ? 0 : cached?.expiresAt ?? 0,
    promise: pendingPromise,
  });

  return pendingPromise;
}

export function invalidateCachedResource(key: string) {
  resourceCache.delete(key);
}

export function invalidateCachedResourcePrefix(prefix: string) {
  Array.from(resourceCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      resourceCache.delete(key);
    }
  });
}

export function writeCachedResource<T>(
  key: string,
  data: T,
  options: { ttlMs?: number } = {},
) {
  resourceCache.set(key, {
    data,
    expiresAt: Date.now() + (options.ttlMs ?? 15_000),
  });
}
