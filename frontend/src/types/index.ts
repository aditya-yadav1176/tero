export type SampleStatus = 'verified' | 'corrected' | 'unreviewed';
export type DatasetSplit = 'train' | 'test';

export interface RecognitionResult {
  predicted_text: string;
  raw_prediction: string;
  inference_time_ms: number;
  model_name: string;
  device: string;
  metadata?: {
    original_size: [number, number];
    ink_pixel_count: number;
    bounding_box: [number, number, number, number];
    preprocessed_size?: [number, number];
    aspect_ratio?: number;
  };
}

export interface HistoryItem {
  id: string;
  image_data: string; // Base64 data URL if on originating device, or empty if on remote device
  predicted_text: string;
  corrected_text?: string;
  is_correct: boolean | null; // null if unreviewed
  status: SampleStatus;
  timestamp: number;
  model_version: string;
  inference_time_ms?: number;
  split?: DatasetSplit; // 'train' or 'test' partition
  originating_device_id?: string;
  has_local_image?: boolean;
}

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'offline' | 'checking';
  model_loaded: boolean;
  model_name: string;
  device: string;
  load_duration_seconds?: number;
  error?: string | null;
  timestamp?: number;
  is_local_in_prod?: boolean;
}

export interface OledMessage {
  message_id: string;
  text: string;
  timestamp: number;
  is_new: boolean;
  source: string;
}
