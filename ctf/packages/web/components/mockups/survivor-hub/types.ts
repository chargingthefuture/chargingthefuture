// Shared chat message type for survivor-hub mockups
export interface ChatMessage {
  id: number;
  from: string;
  text: string;
  action?: string;
}
