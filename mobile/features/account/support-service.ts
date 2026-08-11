import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { logEvent } from '@/lib/observability';

export const supportMessageSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(4000),
});

/**
 * Inserts directly into support_messages — RLS already restricts inserts
 * to `user_id = auth.uid()`, same table the web app's contact-support
 * form writes to and the admin inbox at /admin/support reads from.
 */
export async function submitSupportMessage(input: {
  role: 'customer' | 'business';
  subject: string;
  message: string;
}): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('login_required');

  const parsed = supportMessageSchema.parse({
    subject: input.subject,
    message: input.message,
  });

  const { error } = await supabase.from('support_messages').insert({
    user_id: userId,
    role: input.role,
    subject: parsed.subject,
    message: parsed.message,
  });
  if (error) throw new Error(error.message);
  logEvent('support_message_submitted', { role: input.role });
}
