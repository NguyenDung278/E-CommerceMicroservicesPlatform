import { startTransition, useEffect, useRef, useState, useCallback } from "react";

import {
  createHomeWorkbookSignature,
  loadHomeWorkbookFromFile,
  loadLiveHomeWorkbook,
  type HomeWorkbookContent,
} from "./home-workbook";

// ==========================================
// Types
// ==========================================

export type WorkbookStatus = "loading" | "refreshing" | "ready" | "error";

export type HomeWorkbookState = {
  content: HomeWorkbookContent | null;
  status: WorkbookStatus;
  error: string;
  /** Whether the user is viewing an uploaded local file instead of the live server data */
  isUsingLocalFile: boolean;
  /** Function to handle file upload and parse it as a workbook */
  uploadFile: (file: File | null) => Promise<void>;
  /** Discards the local file and returns to showing the live server workbook */
  resetToLiveSource: () => void;
  /** Forces a refresh of the live workbook from the server */
  reloadLiveSource: () => void;
};

// ==========================================
// Constants & Global Cache
// ==========================================

const LIVE_SYNC_INTERVAL_MS = 12000; // Auto-refresh interval (12 seconds)
const LIVE_WORKBOOK_REUSE_WINDOW_MS = 30000; // How long cache is considered fresh (30 seconds)
const HOME_WORKBOOK_SYNC_EVENT = "home-workbook-sync";
const HOME_WORKBOOK_SYNC_CHANNEL = "home-workbook-sync";
const HOME_WORKBOOK_SYNC_STORAGE_KEY = "__home_workbook_sync__";

type LiveWorkbookCache = {
  content: HomeWorkbookContent | null;
  status: WorkbookStatus;
  error: string;
  /** signature is used to identify if the workbook content has changed (like an ETag) */
  signature: string;
  /** Timestamp of last successful load */
  loadedAt: number;
  /** Prevents duplicate concurrent network requests if multiple components mount */
  pendingRequest: Promise<HomeWorkbookContent> | null;
};

/**
 * Global cache to track the live workbook state outside of the React component lifecycle.
 * This prevents unnecessary re-fetching if the hook is unmounted and quickly remounted.
 */
const liveWorkbookCache: LiveWorkbookCache = {
  content: null,
  status: "loading",
  error: "",
  signature: "",
  loadedAt: 0,
  pendingRequest: null,
};

// ==========================================
// Helper Functions
// ==========================================

/** Safely extract an error message from an unknown error object */
function toErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message;
  }
  return "Unable to load the home workbook.";
}

/** Check if our global cache is still valid based on the allowed time window */
function isLiveWorkbookCacheFresh(): boolean {
  return (
    liveWorkbookCache.content !== null &&
    Date.now() - liveWorkbookCache.loadedAt < LIVE_WORKBOOK_REUSE_WINDOW_MS
  );
}

/** Get the appropriate initial status for the hook based on the current cache */
function readCachedWorkbookStatus(): WorkbookStatus {
  if (liveWorkbookCache.content) {
    return "ready";
  }
  return liveWorkbookCache.status;
}

function markLiveWorkbookCacheStale() {
  liveWorkbookCache.loadedAt = 0;
}

export function publishHomeWorkbookSyncSignal() {
  const payload = {
    triggeredAt: Date.now(),
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HOME_WORKBOOK_SYNC_EVENT, { detail: payload }));
  }

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(HOME_WORKBOOK_SYNC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(HOME_WORKBOOK_SYNC_STORAGE_KEY, String(payload.triggeredAt));
  }
}

/**
 * Shared fetch function. If a fetch is already in-flight, it returns the existing Promise.
 * This ensures multiple consumers won't spam the server at the exact same time.
 */
async function fetchLiveWorkbookShared(): Promise<HomeWorkbookContent> {
  if (!liveWorkbookCache.pendingRequest) {
    liveWorkbookCache.pendingRequest = loadLiveHomeWorkbook().finally(() => {
      // Clear the pending request lock once it's done (success or failure)
      liveWorkbookCache.pendingRequest = null;
    });
  }
  return liveWorkbookCache.pendingRequest;
}

// ==========================================
// Main Hook
// ==========================================

/**
 * A custom hook to manage the state of the Home Workbook.
 * It periodically syncs with the live server or allows overriding with a local file.
 */
export function useHomeWorkbook(): HomeWorkbookState {
  // State is properly initialized from the global cache
  const [content, setContent] = useState<HomeWorkbookContent | null>(
    () => liveWorkbookCache.content
  );
  const [status, setStatus] = useState<WorkbookStatus>(() => readCachedWorkbookStatus());
  const [error, setError] = useState<string>(() => liveWorkbookCache.error);
  const [isUsingLocalFile, setIsUsingLocalFile] = useState<boolean>(false);

  // Use refs to track current signature and version without causing re-renders
  const signatureRef = useRef(liveWorkbookCache.signature);
  const requestVersionRef = useRef(0);

  // Tokens used to force a reload from the server (bypassing the freshness cache)
  const reloadTokenRef = useRef(0);
  const [reloadToken, setReloadToken] = useState(0);

  const requestLiveReload = useCallback(() => {
    markLiveWorkbookCacheStale();
    reloadTokenRef.current += 1;
    setReloadToken(reloadTokenRef.current);
  }, []);

  useEffect(() => {
    if (isUsingLocalFile || typeof window === "undefined") {
      return undefined;
    }

    const handleSyncEvent = () => {
      requestLiveReload();
    };
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === HOME_WORKBOOK_SYNC_STORAGE_KEY) {
        requestLiveReload();
      }
    };
    let channel: BroadcastChannel | null = null;

    window.addEventListener(HOME_WORKBOOK_SYNC_EVENT, handleSyncEvent);
    window.addEventListener("storage", handleStorageEvent);

    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(HOME_WORKBOOK_SYNC_CHANNEL);
      channel.onmessage = () => {
        requestLiveReload();
      };
    }

    return () => {
      window.removeEventListener(HOME_WORKBOOK_SYNC_EVENT, handleSyncEvent);
      window.removeEventListener("storage", handleStorageEvent);
      channel?.close();
    };
  }, [isUsingLocalFile, requestLiveReload]);

  // Sync logic for the live workbook
  useEffect(() => {
    // If we're looking at a local file, stop automatically syncing with the live server.
    if (isUsingLocalFile) {
      return undefined;
    }

    let isComponentMounted = true;
    let shouldForceRefresh = reloadToken > 0;

    async function syncLiveWorkbook() {
      // Track request version to avoid race conditions (i.e. an older slow request resolving after a newer fast one)
      const currentRequestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = currentRequestVersion;

      const forceRefresh = shouldForceRefresh;
      shouldForceRefresh = false;

      // 1. Check Cache Freshness:
      // If we are not forcing a refresh and the cache is fresh, just use it.
      if (!forceRefresh && isLiveWorkbookCacheFresh()) {
        startTransition(() => {
          signatureRef.current = liveWorkbookCache.signature;
          setContent(liveWorkbookCache.content);
          setError(liveWorkbookCache.error);
          setStatus("ready");
        });
        return;
      }

      // 2. Limit background activity:
      // Don't fetch if the user isn't even looking at the browser tab, provided we already have content.
      const isDocumentHidden =
        typeof document !== "undefined" && document.visibilityState === "hidden";

      if (!forceRefresh && isDocumentHidden && liveWorkbookCache.content) {
        startTransition(() => {
          signatureRef.current = liveWorkbookCache.signature;
          setContent(liveWorkbookCache.content);
          setError(liveWorkbookCache.error);
          setStatus("ready");
        });
        return;
      }

      // 3. Mark as loading:
      // If we have an existing signature, indicate "refreshing" (background update)
      // Otherwise, indicate "loading" (blocking UI update)
      startTransition(() => {
        setStatus(signatureRef.current || liveWorkbookCache.signature ? "refreshing" : "loading");
      });

      try {
        // 4. Fetch the data:
        const nextContent = await fetchLiveWorkbookShared();

        // Bail out if component unmounted or a newer request started
        if (!isComponentMounted || requestVersionRef.current !== currentRequestVersion) {
          return;
        }

        const nextSignature = createHomeWorkbookSignature(nextContent);

        // Update global cache
        liveWorkbookCache.content = nextContent;
        liveWorkbookCache.signature = nextSignature;
        liveWorkbookCache.loadedAt = Date.now();
        liveWorkbookCache.error = "";
        liveWorkbookCache.status = "ready";

        // Update component state
        // startTransition marks these updates as low-priority background updates
        startTransition(() => {
          // Only trigger a re-render for content if the signature actually changed
          if (nextSignature !== signatureRef.current) {
            signatureRef.current = nextSignature;
            setContent(nextContent);
          }
          setError("");
          setStatus("ready");
        });
      } catch (reason) {
        if (!isComponentMounted || requestVersionRef.current !== currentRequestVersion) {
          return;
        }

        const nextError = toErrorMessage(reason);
        // Keep the content if we have a signature, but store the error
        liveWorkbookCache.error = nextError;
        liveWorkbookCache.status = liveWorkbookCache.signature ? "ready" : "error";

        startTransition(() => {
          setError(nextError);
          setStatus(signatureRef.current ? "ready" : "error");
        });
      }
    }

    // Initial sync call
    void syncLiveWorkbook();

    // Setup interval for periodic polling
    const intervalId = window.setInterval(() => {
      void syncLiveWorkbook();
    }, LIVE_SYNC_INTERVAL_MS);

    // Cleanup function: clears interval and marks component as unmounted
    return () => {
      isComponentMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isUsingLocalFile, reloadToken]);

  // Handle uploading a local testing file
  // Wrapped in useCallback to maintain a stable reference
  const uploadFile = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    startTransition(() => {
      setStatus("loading");
    });

    try {
      const nextContent = await loadHomeWorkbookFromFile(file);
      const nextSignature = createHomeWorkbookSignature(nextContent);

      startTransition(() => {
        signatureRef.current = nextSignature;
        setContent(nextContent);
        setIsUsingLocalFile(true); // Switch mode to local file
        setError("");
        setStatus("ready");
      });
    } catch (reason) {
      startTransition(() => {
        setError(toErrorMessage(reason));
        setStatus(signatureRef.current ? "ready" : "error");
      });
    }
  }, []);

  // Return to live server data
  // Wrapped in useCallback to maintain a stable reference
  const resetToLiveSource = useCallback(() => {
    if (!isUsingLocalFile) {
      return;
    }

    startTransition(() => {
      setContent(liveWorkbookCache.content);
      setError(liveWorkbookCache.error);
      setStatus(readCachedWorkbookStatus());
      setIsUsingLocalFile(false); // Switch mode back to live
    });

    // Bump token to trigger a live sync
    requestLiveReload();
  }, [isUsingLocalFile, requestLiveReload]);

  // Force refresh live data manually
  // Wrapped in useCallback to maintain a stable reference
  const reloadLiveSource = useCallback(() => {
    if (isUsingLocalFile) {
      return;
    }

    requestLiveReload();
  }, [isUsingLocalFile, requestLiveReload]);

  return {
    content,
    status,
    error,
    isUsingLocalFile,
    uploadFile,
    resetToLiveSource,
    reloadLiveSource,
  };
}
