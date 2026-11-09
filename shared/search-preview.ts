import type { SearchDataset } from "./types.js";
export interface SearchPreview
  extends Pick<
    SearchDataset,
    "id" | "metadata" | "summary" | "rows" | "warnings"
  > {
  count: number;
}
