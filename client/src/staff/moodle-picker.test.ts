import { describe, expect, it } from "vitest";
import { expandCategorySelection } from "./pages/course-form";

const categories = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 2 },
  { id: 4, parentId: null },
  { id: 5, parentId: 4 },
];

describe("expandCategorySelection", () => {
  it("keeps lone selections and adds descendants of a picked parent", () => {
    expect([...expandCategorySelection(categories, [4])].sort()).toEqual([4, 5]);
    expect([...expandCategorySelection(categories, [1])].sort()).toEqual([
      1, 2, 3,
    ]);
    expect([...expandCategorySelection(categories, [3])].sort()).toEqual([3]);
    expect(expandCategorySelection(categories, []).size).toBe(0);
  });
});
