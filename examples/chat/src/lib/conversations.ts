import { z } from 'zod';

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  status: z.enum(['streaming', 'complete', 'stopped', 'error', 'truncated']),
  model: z.string().optional(),
  chunks: z.number().default(0),
  elapsedMs: z.number().optional(),
  error: z.string().optional(),
});
const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  updatedAt: z.number(),
  messages: z.array(messageSchema),
});
export type Message = z.infer<typeof messageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
const key = 'streamtag-chat:conversations:v1';

export function newConversation(model = ''): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    model,
    messages: [],
    updatedAt: Date.now(),
  };
}

export function loadConversations(): Conversation[] {
  try {
    const result = z
      .array(conversationSchema)
      .max(12)
      .parse(JSON.parse(localStorage.getItem(key) || '[]'));
    if (result.length)
      return result.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.status === 'streaming'
            ? { ...message, status: 'stopped' as const }
            : message,
        ),
      }));
  } catch {
    /* Invalid or unavailable browser storage starts a new local session. */
  }
  return [newConversation()];
}

export function persistConversations(conversations: Conversation[]) {
  localStorage.setItem(key, JSON.stringify(conversations.slice(0, 12)));
}

/** Send completed revisions only. Interrupted markup must not become model context. */
export function modelHistory(messages: Message[]) {
  return messages
    .filter(
      (message) => message.role === 'user' || message.status === 'complete',
    )
    .map(({ role, content }) => ({ role, content }));
}
