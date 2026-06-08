import { z } from "zod";

const ModerationInput = z.object({
  contentId: z.string(),
  text: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type ModerationResult = {
  flagged: boolean;
  reasons: string[];
  severity: "low" | "medium" | "high" | "critical";
};

const CRISIS_KEYWORDS = [
  "suicide", "kill myself", "self-harm", "end it all", "want to die",
];

export async function moderateContent(raw: unknown): Promise<ModerationResult> {
  const input = ModerationInput.parse(raw);
  const reasons: string[] = [];

  // Crisis keyword detection (fast path, no API call needed)
  if (input.text) {
    const lower = input.text.toLowerCase();
    for (const keyword of CRISIS_KEYWORDS) {
      if (lower.includes(keyword)) {
        return { flagged: true, reasons: ["crisis_keyword_detected"], severity: "critical" };
      }
    }
  }

  // Cloud Natural Language API — toxicity analysis
  if (input.text) {
    try {
      // In production: call Cloud Natural Language API
      // const nlClient = new LanguageServiceClient();
      // const [result] = await nlClient.analyzeSentiment({ document: { content: input.text, type: 'PLAIN_TEXT' } });
      // Check for negative sentiment below threshold
      const toxicPatterns = [
        /\b(threat|threaten|kill|attack|bomb)\b/i,
        /\b(hate|racist|sexist)\b/i,
      ];
      for (const pattern of toxicPatterns) {
        if (pattern.test(input.text)) {
          reasons.push("toxic_content_detected");
          break;
        }
      }
    } catch {
      // Log but don't block on NL API failure
    }
  }

  // Cloud Vision SafeSearch — image moderation
  if (input.imageUrl) {
    try {
      // In production: call Cloud Vision SafeSearch API
      // const visionClient = new ImageAnnotatorClient();
      // const [result] = await visionClient.safeSearchDetection(input.imageUrl);
      // Check adult, violence, racy ratings
      reasons.push("image_pending_review");
    } catch {
      // Log but don't block on Vision API failure
    }
  }

  const severity = reasons.length > 0 ? "medium" : "low";
  return { flagged: reasons.length > 0, reasons, severity };
}
