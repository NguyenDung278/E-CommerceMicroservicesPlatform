import { startTransition, useEffect, useRef, useState } from "react";

import {
  createHomeWorkbookSignature,
  loadHomeWorkbookFromFile,
  loadLiveHomeWorkbook,
  type HomeWorkbookContent,
} from "./workbook";

type WorkbookStatus = "loading" | "refreshing" | "ready" | "error";

export type HomeWorkbookState = {
  content: HomeWorkbookContent | null;
  status: WorkbookStatus;
  error: string;
  isUsingLocalFile: boolean;
  uploadFile: (file: File | null) => Promise<void>;
  resetToLiveSource: () => void;
  reloadLiveSource: () => void;
};

const liveSyncIntervalMs = 12000;

function toErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message;
  }

  return "Unable to load the home workbook.";
}

export function useHomeWorkbook(): HomeWorkbookState {
  const [content, setContent] = useState<HomeWorkbookContent | null>(null);
  const [status, setStatus] = useState<WorkbookStatus>("loading");
  const [error, setError] = useState("");
  const [isUsingLocalFile, setIsUsingLocalFile] = useState(false);

  const signatureRef = useRef("");
  const requestVersionRef = useRef(0);
  const reloadTokenRef = useRef(0);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (isUsingLocalFile) {
      return undefined;
    }

    let active = true;

    async function syncLiveWorkbook() {
      const nextVersion = requestVersionRef.current + 1;
      requestVersionRef.current = nextVersion;

      startTransition(() => {
        setStatus(signatureRef.current ? "refreshing" : "loading");
      });

      try {
        const nextContent = await loadLiveHomeWorkbook();

        if (!active || requestVersionRef.current !== nextVersion) {
          return;
        }

        const nextSignature = createHomeWorkbookSignature(nextContent);

        startTransition(() => {
          if (nextSignature !== signatureRef.current) {
            signatureRef.current = nextSignature;
            setContent(nextContent);
          }
          setError("");
          setStatus("ready");
        });
      } catch (reason) {
        if (!active || requestVersionRef.current !== nextVersion) {
          return;
        }

        startTransition(() => {
          setError(toErrorMessage(reason));
          setStatus(signatureRef.current ? "ready" : "error");
        });
      }
    }

    void syncLiveWorkbook();
    const intervalId = window.setInterval(() => {
      void syncLiveWorkbook();
    }, liveSyncIntervalMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isUsingLocalFile, reloadToken]);

  async function uploadFile(file: File | null) {
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
        setIsUsingLocalFile(true);
        setError("");
        setStatus("ready");
      });
    } catch (reason) {
      startTransition(() => {
        setError(toErrorMessage(reason));
        setStatus(signatureRef.current ? "ready" : "error");
      });
    }
  }

  function resetToLiveSource() {
    if (!isUsingLocalFile) {
      return;
    }

    startTransition(() => {
      setIsUsingLocalFile(false);
    });
    reloadTokenRef.current += 1;
    setReloadToken(reloadTokenRef.current);
  }

  function reloadLiveSource() {
    if (isUsingLocalFile) {
      return;
    }

    reloadTokenRef.current += 1;
    setReloadToken(reloadTokenRef.current);
  }

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
