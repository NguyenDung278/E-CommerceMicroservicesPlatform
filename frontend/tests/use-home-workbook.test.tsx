import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeWorkbookContent } from "../src/features/home/home-workbook";

const homeWorkbookMocks = vi.hoisted(() => ({
  createHomeWorkbookSignature: vi.fn((content: HomeWorkbookContent) => content.sourceName),
  loadHomeWorkbookFromFile: vi.fn(),
  loadLiveHomeWorkbook: vi.fn(),
}));

vi.mock("../src/features/home/home-workbook", () => ({
  createHomeWorkbookSignature: homeWorkbookMocks.createHomeWorkbookSignature,
  loadHomeWorkbookFromFile: homeWorkbookMocks.loadHomeWorkbookFromFile,
  loadLiveHomeWorkbook: homeWorkbookMocks.loadLiveHomeWorkbook,
}));

import { publishHomeWorkbookSyncSignal, useHomeWorkbook } from "../src/features/home/use-home-workbook";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type ProbeSnapshot = {
  sourceName: string | null;
  status: string;
};

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }

  homeWorkbookMocks.createHomeWorkbookSignature.mockClear();
  homeWorkbookMocks.loadHomeWorkbookFromFile.mockReset();
  homeWorkbookMocks.loadLiveHomeWorkbook.mockReset();
  window.localStorage.clear();
});

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function buildWorkbookContent(sourceName: string): HomeWorkbookContent {
  return {
    sourceName,
    sourceKind: "csv",
    loadedAt: sourceName,
    footer: {
      brandName: "ND Shop",
      caption: "Crafted for the Discerning",
      note: "Workbook sync fixture.",
    },
    footerLinks: [],
    navItems: [
      {
        position: 1,
        slug: "all-archive",
        label: "All Archive",
        href: "/products",
        isDefault: true,
      },
    ],
    segments: [
      {
        slug: "all-archive",
        label: "All Archive",
        href: "/products",
        isDefault: true,
        hero: {
          segmentSlug: "all-archive",
          collectionKicker: "Editorial",
          title: "Forest & Hearth",
          description: "Workbook sync fixture.",
          primaryCtaLabel: "Explore",
          primaryCtaHref: "/products",
          secondaryCtaLabel: "Details",
          secondaryCtaHref: "/products",
          backgroundImage: "https://example.com/hero.jpg",
          quoteKicker: "Note",
          quoteBody: "Workbook sync fixture.",
          accent: "#946246",
          arrivalsKicker: "New",
          arrivalsTitle: "Pieces",
        },
        tiles: [],
        callout: null,
        metrics: [],
        products: [],
      },
    ],
    categoryPages: [],
  };
}

function WorkbookProbe({ onSnapshot }: { onSnapshot: (snapshot: ProbeSnapshot) => void }) {
  const state = useHomeWorkbook();

  useEffect(() => {
    onSnapshot({
      sourceName: state.content?.sourceName ?? null,
      status: state.status,
    });
  }, [onSnapshot, state.content?.sourceName, state.status]);

  return null;
}

function renderWorkbookProbe(onSnapshot: (snapshot: ProbeSnapshot) => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<WorkbookProbe onSnapshot={onSnapshot} />);
  });

  mountedRoots.push({
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  });
}

async function waitFor(assertion: () => void, timeoutMs = 3000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  throw lastError;
}

describe("useHomeWorkbook", () => {
  it("starts a fresh live workbook request when a sync signal arrives during an in-flight load", async () => {
    const firstRequest = createDeferred<HomeWorkbookContent>();
    const secondRequest = createDeferred<HomeWorkbookContent>();
    let latestSnapshot: ProbeSnapshot = {
      sourceName: null,
      status: "loading",
    };

    homeWorkbookMocks.loadLiveHomeWorkbook
      .mockImplementation(() => secondRequest.promise)
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    renderWorkbookProbe((snapshot) => {
      latestSnapshot = snapshot;
    });

    await waitFor(() => {
      expect(homeWorkbookMocks.loadLiveHomeWorkbook).toHaveBeenCalledTimes(1);
      expect(latestSnapshot.status).toBe("loading");
    });

    act(() => {
      publishHomeWorkbookSyncSignal();
    });

    await waitFor(() => {
      expect(homeWorkbookMocks.loadLiveHomeWorkbook.mock.calls.length).toBeGreaterThan(1);
    });

    await act(async () => {
      secondRequest.resolve(buildWorkbookContent("fresh-workbook.csv"));
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(latestSnapshot.status).toBe("ready");
      expect(latestSnapshot.sourceName).toBe("fresh-workbook.csv");
    });

    await act(async () => {
      firstRequest.resolve(buildWorkbookContent("stale-workbook.csv"));
      await firstRequest.promise;
    });

    await waitFor(() => {
      expect(latestSnapshot.sourceName).toBe("fresh-workbook.csv");
    });
  });
});
