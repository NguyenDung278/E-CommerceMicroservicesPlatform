import { preloadRouteByPath } from "./route-preloaders";

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleRequestCallbackLike = (deadline: IdleDeadlineLike) => void;

type IdleRequestOptionsLike = {
  timeout?: number;
};

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallbackLike,
      options?: IdleRequestOptionsLike
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

const externalHrefPattern = /^(?:[a-z]+:)?\/\//i;

export function isExternalRouteHref(href: string) {
  return externalHrefPattern.test(href.trim());
}

export function prefetchRouteIntent(href: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedHref = href.trim();

  if (!normalizedHref || isExternalRouteHref(normalizedHref)) {
    return null;
  }

  return preloadRouteByPath(normalizedHref);
}

export function scheduleRoutePrefetch(task: () => void, timeout = 240) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => {
      task();
    }, { timeout: 1200 });

    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const fallbackHandle = window.setTimeout(task, timeout);
  return () => {
    window.clearTimeout(fallbackHandle);
  };
}
