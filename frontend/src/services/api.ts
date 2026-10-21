import type { BackendHealth, RecognitionResult, OledMessage } from '../types';

export function getApiConfig(): { url: string; isConfigured: boolean; isLocalhostInProd: boolean } {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // If running in production (e.g. deployed on Vercel)
  if (import.meta.env.PROD || (isBrowser && !isLocalHost)) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return {
        url: '',
        isConfigured: false,
        isLocalhostInProd: true,
      };
    }
    return {
      url: envUrl.replace(/\/+$/, ''),
      isConfigured: true,
      isLocalhostInProd: false,
    };
  }

  // Local development
  return {
    url: envUrl ? envUrl.replace(/\/+$/, '') : 'http://127.0.0.1:8000',
    isConfigured: true,
    isLocalhostInProd: false,
  };
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  const config = getApiConfig();

  if (config.isLocalhostInProd) {
    return {
      status: 'offline',
      model_loaded: false,
      model_name: 'Backend URL Missing',
      device: 'None',
      error: 'Deployed on Vercel without a cloud backend URL. Set VITE_API_BASE_URL in Vercel to your deployed FastAPI server.',
      is_local_in_prod: true,
      timestamp: Date.now(),
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${config.url}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: 'degraded',
        model_loaded: false,
        model_name: 'Unknown',
        device: 'Unknown',
        error: `Server returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      status: data.status,
      model_loaded: data.model_loaded,
      model_name: data.model_name,
      device: data.device,
      load_duration_seconds: data.load_duration_seconds,
      error: data.error,
      timestamp: data.timestamp,
    };
  } catch (err: unknown) {
    return {
      status: 'offline',
      model_loaded: false,
      model_name: 'Not connected',
      device: 'None',
      error: err instanceof Error ? err.message : 'Unable to connect to Python backend server',
    };
  }
}

export async function recognizeHandwriting(
  imageDataUrl: string,
  maxTokens: number = 25
): Promise<RecognitionResult> {
  const config = getApiConfig();

  if (config.isLocalhostInProd) {
    throw new Error(
      'Online recognition backend not configured. Deploy your FastAPI server to a public host and set VITE_API_BASE_URL in Vercel, or test recognition locally on your laptop.'
    );
  }

  try {
    const response = await fetch(`${config.url}/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageDataUrl,
        max_tokens: maxTokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.detail || `Recognition error (${response.status})`;
      throw new Error(errorMsg);
    }

    return {
      predicted_text: data.predicted_text,
      raw_prediction: data.raw_prediction,
      inference_time_ms: data.inference_time_ms,
      model_name: data.model_name,
      device: data.device,
      metadata: data.metadata,
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('An unexpected error occurred during recognition');
  }
}

export async function sendOledMessage(text: string): Promise<OledMessage> {
  const config = getApiConfig();
  if (config.isLocalhostInProd) {
    throw new Error('Backend not available in cloud deployment without VITE_API_BASE_URL.');
  }

  const response = await fetch(`${config.url}/api/oled/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.trim(),
      source: 'web',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to queue OLED message: HTTP ${response.status}`);
  }

  return response.json();
}

export async function getOledMessage(): Promise<OledMessage> {
  const config = getApiConfig();
  const response = await fetch(`${config.url}/api/oled/message`);
  if (!response.ok) {
    throw new Error(`Failed to poll OLED message: HTTP ${response.status}`);
  }
  return response.json();
}
