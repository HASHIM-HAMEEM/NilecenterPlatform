/** Per-language guide text, keyed to the language-independent content.ts ids. */
export type GuideText = {
  categories: Record<string, { title: string; summary: string }>;
  scenarios: Record<
    string,
    {
      title: string;
      summary: string;
      steps: { title: string; body: string }[];
      notes: string[];
    }
  >;
};
