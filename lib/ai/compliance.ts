const prohibitedRecommendation = /\b(buy|sell|hold|short|trade)\b.{0,45}\b(should|now|recommend|recommendation)\b/i;

/** A small shared policy guard for any future AI-generated paper-trading copy. */
export function guardEducationalOutput(text: string): string {
  if (prohibitedRecommendation.test(text)) {
    return "This educational summary avoids personalized trading recommendations. Consider the information alongside your own research.";
  }
  return text;
}
