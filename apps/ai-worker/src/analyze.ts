import { z } from "zod";

const AnalysisInput = z.object({
  contentId: z.string(),
  text: z.string(),
  type: z.enum(["sentiment_tag", "topic_tag", "tone_analysis", "retro_grouping", "manager_brief"]),
  workspaceId: z.string().optional(),
});

export type AnalysisResult = {
  contentId: string;
  type: string;
  result: Record<string, unknown>;
};

export async function analyzeContent(raw: unknown): Promise<AnalysisResult> {
  const input = AnalysisInput.parse(raw);

  // In production: call Vertex AI Gemini Flash
  // const vertexai = new VertexAI({ project: process.env.GCP_PROJECT, location: 'us-central1' });
  // const model = vertexai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const analysisHandlers: Record<string, () => Record<string, unknown>> = {
    sentiment_tag: () => ({
      sentiment: "constructive",
      confidence: 0.85,
      keywords: ["feedback", "improvement"],
    }),
    topic_tag: () => ({
      topic: "process",
      subtopics: ["sprint_planning", "tech_debt"],
      confidence: 0.78,
    }),
    tone_analysis: () => ({
      tone: "playful",
      description: "This feels warm and lighthearted",
      confidence: 0.72,
    }),
    retro_grouping: () => ({
      groups: [
        { name: "Process improvements", itemCount: 5 },
        { name: "Team culture", itemCount: 3 },
        { name: "Tooling", itemCount: 2 },
      ],
    }),
    manager_brief: () => ({
      summary: "Overall sentiment is constructive. Key themes: sprint planning improvements (mentioned 3x), async communication preference (2x).",
      actionItems: [
        "Consider allocating 20% of sprint capacity for tech debt",
        "Trial async standups for one sprint",
      ],
      trendDirection: "improving",
    }),
  };

  const handler = analysisHandlers[input.type];
  const result = handler ? handler() : { placeholder: true };

  return {
    contentId: input.contentId,
    type: input.type,
    result,
  };
}
