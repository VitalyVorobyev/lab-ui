/**
 * Every story module in the workspace, composed with this Storybook's project annotations —
 * the one list both harness projects iterate.
 */

import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import type { ComponentType } from "react";

import * as preview from "../.storybook/preview";

setProjectAnnotations(preview);

type StoryModule = Parameters<typeof composeStories>[0];

const modules = import.meta.glob<StoryModule>("../../../packages/*/src/**/*.stories.tsx", { eager: true });

/** The part of a composed story the harness uses: render it, or run it (render + `play`). */
export type ComposedStory = ComponentType & { run: (context?: { canvasElement?: HTMLElement }) => Promise<void> };

export interface Case {
  /** `<package>/<Title> › <Story>`, for the test name. */
  id: string;
  Story: ComposedStory;
}

export const cases: Case[] = Object.entries(modules).flatMap(([path, module]) => {
  const pkg = /packages\/([^/]+)\//.exec(path)?.[1] ?? "?";
  const title = (module.default as { title?: string }).title ?? path;
  const composed = composeStories(module) as unknown as Record<string, ComposedStory>;
  return Object.entries(composed).map(([name, Story]) => ({ id: `${pkg} · ${title} › ${name}`, Story }));
});
