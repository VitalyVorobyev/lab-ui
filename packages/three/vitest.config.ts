import { library } from "@vitavision/config-vitest";

// No components, so no stories: logic runs in happy-dom (`*.test.ts`), and what needs a real
// browser (WebGL read-back, the CSS colour parser) runs in Chromium (`*.browser.test.ts`).
// Rendering through React is exercised by @vitavision/three-react's stories.
export default library();
