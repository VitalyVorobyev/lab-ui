/**
 * `@vitavision/lab-ui` — **deprecated**: the 0.x single package, kept as a re-export of the
 * packages it was split into so its consumers can migrate one import at a time.
 *
 * | Was                          | Now                     |
 * |------------------------------|-------------------------|
 * | tokens, theme, primitives    | `@vitavision/ui`        |
 * | `SchemaForm`, schema helpers | `@vitavision/forms`     |
 * | charts, scales               | `@vitavision/charts`    |
 * | `ImageStage`, measure, planes| `@vitavision/stage2d`   |
 *
 * The exported surface is identical to 0.5; see the README for the migration.
 */

export * from "@vitavision/ui";
export * from "@vitavision/forms";
export * from "@vitavision/charts";
export * from "@vitavision/stage2d";
