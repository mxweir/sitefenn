import type { ViewportProfile } from "./types.js";
export const VIEWPORTS: ViewportProfile[] = [
  { id: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
  {
    id: "tablet",
    width: 768,
    height: 1024,
    hasTouch: true,
    deviceScaleFactor: 1,
  },
  {
    id: "mobile",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  },
];
