export type ToastKind = 'success' | 'info' | 'error';

export interface ToastDetail {
  message: string;
  kind: ToastKind;
}

export const toastEventName = 'eduflow:toast';

export function showToast(message: string, kind: ToastKind = 'success') {
  const content = message.trim();
  if (!content) return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(toastEventName, {
    detail: { message: content, kind },
  }));
}
