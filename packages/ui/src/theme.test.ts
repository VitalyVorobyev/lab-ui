import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME_STORAGE_KEY,
  initTheme,
  readThemeChoice,
  resolveTheme,
  setThemeChoice,
  type ThemeChoice,
} from "./theme";

const CHOICES: ThemeChoice[] = ["light", "dark", "system"];

/** A controllable `prefers-color-scheme: dark` query. */
function fakeMedia(initiallyDark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initiallyDark,
    addEventListener: vi.fn((_: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  return {
    media,
    listeners,
    setDark(dark: boolean) {
      media.matches = dark;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * An environment with no `matchMedia` at all (an old WebView, a test runner).
 *
 * @returns A function that puts the original back.
 */
function withoutMatchMedia(): () => void {
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true, writable: true });
  return () => {
    if (original) Object.defineProperty(window, "matchMedia", original);
    else Reflect.deleteProperty(window, "matchMedia");
  };
}

const isDark = () => document.documentElement.classList.contains("dark");

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readThemeChoice", () => {
  it("is 'system' when nothing is stored", () => {
    expect(readThemeChoice()).toBe("system");
  });

  it.each(CHOICES)("reads a stored %s back as itself", (choice) => {
    window.localStorage.setItem(DEFAULT_THEME_STORAGE_KEY, choice);
    expect(readThemeChoice()).toBe(choice);
  });

  it("ignores a value it did not write", () => {
    window.localStorage.setItem(DEFAULT_THEME_STORAGE_KEY, "sepia");
    expect(readThemeChoice()).toBe("system");
  });

  it("keeps apps apart by key", () => {
    window.localStorage.setItem("app-a", "dark");
    expect(readThemeChoice("app-a")).toBe("dark");
    expect(readThemeChoice("app-b")).toBe("system");
  });

  it("falls back to 'system' when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readThemeChoice()).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("returns an explicit choice unchanged, whatever the OS says", () => {
    fakeMedia(true);
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("follows the OS for 'system'", () => {
    const os = fakeMedia(false);
    expect(resolveTheme("system")).toBe("light");
    os.setDark(true);
    expect(resolveTheme("system")).toBe("dark");
  });

  it("resolves 'system' to light where the OS cannot be asked", () => {
    const restore = withoutMatchMedia();
    try {
      expect(resolveTheme("system")).toBe("light");
    } finally {
      restore();
    }
  });
});

describe("setThemeChoice", () => {
  it.each(CHOICES)("stores %s and paints what it resolves to", (choice) => {
    fakeMedia(true);
    setThemeChoice(choice);
    expect(window.localStorage.getItem(DEFAULT_THEME_STORAGE_KEY)).toBe(choice);
    expect(isDark()).toBe(resolveTheme(choice) === "dark");
    // Round trip: what was set is what is read.
    expect(readThemeChoice()).toBe(choice);
  });

  it("still paints when storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    setThemeChoice("dark", "app");
    expect(isDark()).toBe(true);
  });
});

describe("initTheme", () => {
  it("paints the stored choice", () => {
    fakeMedia(false);
    window.localStorage.setItem("app", "dark");
    const stop = initTheme("app");
    expect(isDark()).toBe(true);
    stop();
  });

  it("follows the OS while the choice is 'system', and stops when it is not", () => {
    const os = fakeMedia(false);
    const stop = initTheme();
    expect(isDark()).toBe(false);

    os.setDark(true);
    expect(isDark()).toBe(true);

    // An explicit choice is not overridden by the OS.
    setThemeChoice("light");
    os.setDark(true);
    expect(isDark()).toBe(false);

    stop();
    expect(os.listeners.size).toBe(0);
  });

  it("returns a no-op unsubscribe where the OS cannot be asked", () => {
    const restore = withoutMatchMedia();
    try {
      const stop = initTheme();
      expect(isDark()).toBe(false);
      expect(stop).not.toThrow();
    } finally {
      restore();
    }
  });
});
