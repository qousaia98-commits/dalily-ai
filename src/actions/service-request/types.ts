export type ServiceRequestActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  requestId?: string;
  conversationId?: string;
};
