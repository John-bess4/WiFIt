import { sb } from './supabase.js';
export const sharingCategories = [
  ['workouts', 'Workout information'], ['nutrition', 'Nutrition history'],
  ['nutrition_adherence', 'Nutrition adherence score'], ['supplements', 'Supplement history'],
  ['sessions', 'Session history'], ['progress_measurements', 'Progress measurements'],
  ['progress_photos', 'Progress photos'], ['health_summaries', 'Health summaries'], ['messaging', 'Messaging'],
];
export const operation = (action, payload) => ({ action, payload: { ...payload, operation_id: crypto.randomUUID() } });
export async function trainerAPI(command) {
  if (!sb.getUser()) throw new Error('Sign in with your WiFit account to continue.');
  const response = await sb._fetch('/functions/v1/trainerhq-api', { method: 'POST', cache: 'no-store', body: JSON.stringify(command) });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.error?.message || (response.status === 401 ? 'Your session expired. Sign in again.' : 'This request could not be completed. Retry when you are online.'));
  if (value === null) throw new Error('The service returned an unreadable response. Refresh and try again.');
  return value;
}
export const trainerRead = (action, payload = {}) => trainerAPI({ action, payload });

export async function readAttachment(attachment) {
  if (!sb.getUser()) throw new Error('Sign in to view this attachment.');
  if (attachment.bucket !== 'trainerhq-message-attachments' || !['image/jpeg','image/png','application/pdf'].includes(attachment.mime_type) || attachment.byte_count > 10485760) throw new Error('Unsupported attachment.');
  const path = attachment.object_path.split('/').map(encodeURIComponent).join('/');
  const response = await sb._fetch('/storage/v1/object/authenticated/' + attachment.bucket + '/' + path, { cache: 'no-store' });
  if (!response.ok) throw new Error('This attachment is unavailable or your access has changed.');
  const blob = await response.blob();
  if (blob.size !== attachment.byte_count || blob.size > 10485760) throw new Error('The attachment could not be verified.');
  return new Blob([blob], { type: attachment.mime_type });
}
