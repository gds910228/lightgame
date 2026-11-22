// 反馈表单 API：提交到独立 Worker 端点（forms.misitebo.win），与静态站托管解耦。
// Turnstile sitekey 是公开值；真正的密钥全在 Worker secrets 里，浏览器包不含任何私密凭证。

const ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT || 'https://forms.misitebo.win/feedback';
// Turnstile sitekey 是公开值（真正的密钥在 Worker secrets 里）
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '0x4AAAAAAGM4nR8v4hUrFT6Y';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Failed to load Turnstile'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface TurnstileWidget {
  reset: () => void;
  remove: () => void;
}

// 渲染验证组件；token 通过回调返回（一次性，提交后调用 widget.reset()）
export async function renderTurnstile(
  el: HTMLElement,
  onToken: (token: string) => void
): Promise<TurnstileWidget> {
  await loadTurnstile();
  const widgetId = window.turnstile!.render(el, {
    sitekey: TURNSTILE_SITEKEY,
    callback: onToken,
    'expired-callback': () => onToken(''),
    'error-callback': () => onToken(''),
  });
  return {
    reset: () => window.turnstile?.reset(widgetId),
    remove: () => window.turnstile?.remove(widgetId),
  };
}

export interface FeedbackPayload {
  name?: string;
  email?: string;
  game?: string;
  feedbackType?: string;
  message?: string;
  rating?: string;
  turnstileToken: string;
  website?: string; // honeypot
}

type SubmitResult =
  | { success: true }
  | { success: false; errorMessage: string };

export const submitFeedback = async (payload: FeedbackPayload): Promise<SubmitResult> => {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({} as Record<string, string>));
    if (response.ok) return { success: true };
    return {
      success: false,
      errorMessage:
        result.error === 'captcha_failed'
          ? 'Verification failed, please retry the checkbox and submit again.'
          : result.error === 'rate_limited'
            ? 'Too many submissions, please try again later.'
            : 'Unknown error',
    };
  } catch (error) {
    console.error('提交反馈失败:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Network error',
    };
  }
};
