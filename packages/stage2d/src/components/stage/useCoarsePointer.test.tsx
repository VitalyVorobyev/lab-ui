import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCoarsePointer } from "./useCoarsePointer";

afterEach(() => vi.unstubAllGlobals());

describe("useCoarsePointer", () => {
  it("follows (pointer: coarse), including a change", () => {
    let listener = () => {};
    const list = {
      matches: true,
      addEventListener: (_: string, l: () => void) => (listener = l),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => list);
    const { result, unmount } = renderHook(() => useCoarsePointer());
    expect(result.current).toBe(true);
    list.matches = false;
    act(() => listener());
    expect(result.current).toBe(false);
    unmount();
    expect(list.removeEventListener).toHaveBeenCalled();
  });

  it("is false where matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useCoarsePointer());
    expect(result.current).toBe(false);
  });
});
