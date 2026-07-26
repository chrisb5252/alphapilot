export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  details?: CopilotResponse;
};

export type CopilotResponse = {
  answer: string;
  highlights: string[];
  caveat: string;
  suggestedQuestions: string[];
};
