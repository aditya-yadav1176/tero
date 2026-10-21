import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Check,
  Edit2,
} from 'lucide-react';
import { DrawingCanvas } from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import { recognizeHandwriting, sendOledMessage } from '../services/api';
import { saveRecognitionAttempt, updateHistoryItem } from '../services/storage';
import type { RecognitionResult, BackendHealth, SampleStatus } from '../types';

interface WriteScreenProps {
  backendHealth: BackendHealth;
  onOpenHardwareModal: (stagedText?: string) => void;
  onAttemptSaved: () => void;
}

export const WriteScreen: React.FC<WriteScreenProps> = ({
  backendHealth,
  onOpenHardwareModal,
  onAttemptSaved,
}) => {
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  // Recognition state
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);

  // Current history record ID (ensures updates modify existing record, not duplicate)
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

  // User feedback & correction state
  const [editedText, setEditedText] = useState<string>('');
  const [correctionStatus, setCorrectionStatus] = useState<SampleStatus>('unreviewed');
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Trigger recognition & automatically create history record
  const handleRecognize = async () => {
    if (!canvasRef.current) return;

    if (!canvasRef.current.hasStrokes()) {
      setRecognitionError('Canvas is empty. Draw a character or word first.');
      return;
    }

    if (!backendHealth.model_loaded) {
      setRecognitionError(
        backendHealth.status === 'offline'
          ? (backendHealth.error || 'Backend Python server is offline. Run: uvicorn main:app --reload in backend folder.')
          : 'TrOCR model is still initializing on CPU. Please wait a moment.'
      );
      return;
    }

    setRecognitionError(null);
    setFeedbackNotice(null);
    setIsRecognizing(true);

    try {
      const dataUrl = canvasRef.current.getImageDataUrl();
      setCapturedImageData(dataUrl);

      // Run real TrOCR inference
      const res = await recognizeHandwriting(dataUrl);
      setResult(res);
      setEditedText(res.predicted_text);
      setCorrectionStatus('unreviewed');

      // 1. AUTOMATIC HISTORY: Automatically create history record
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await saveRecognitionAttempt({
        id: recordId,
        image_data: dataUrl,
        predicted_text: res.predicted_text,
        corrected_text: res.predicted_text, // initially equal to prediction
        is_correct: null, // unreviewed until user explicitly confirms or edits
        status: 'unreviewed',
        model_version: res.model_name,
        inference_time_ms: res.inference_time_ms,
      });

      setCurrentRecordId(recordId);
      setFeedbackNotice(`Automatically saved to history (ID: ${recordId.substring(0, 10)}...)`);
      onAttemptSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Recognition failed. Please try again.';
      setRecognitionError(msg);
      setResult(null);
      setCurrentRecordId(null);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Confirm prediction without changing it
  const handleConfirmCorrect = async () => {
    if (!currentRecordId || !result) return;

    setIsUpdating(true);
    try {
      await updateHistoryItem(currentRecordId, {
        corrected_text: result.predicted_text,
        is_correct: true,
        status: 'verified',
      });
      setCorrectionStatus('verified');
      setEditedText(result.predicted_text);
      setFeedbackNotice('Prediction confirmed as verified ground truth.');
      onAttemptSaved();
    } catch (err) {
      console.warn('Update failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // User edited text: update existing history record
  const handleSaveCorrection = async (textToSave?: string) => {
    if (!currentRecordId || !result) return;
    const finalVal = (textToSave !== undefined ? textToSave : editedText).trim();
    if (!finalVal) return;

    setIsUpdating(true);
    try {
      const isExactMatch = finalVal.toLowerCase() === result.predicted_text.toLowerCase();
      const status: SampleStatus = isExactMatch ? 'verified' : 'corrected';

      await updateHistoryItem(currentRecordId, {
        corrected_text: finalVal,
        is_correct: isExactMatch,
        status,
      });

      setCorrectionStatus(status);
      setFeedbackNotice(
        isExactMatch
          ? 'Confirmed prediction as verified.'
          : `History record updated with corrected label "${finalVal}".`
      );
      onAttemptSaved();
    } catch (err) {
      console.warn('Correction update failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Blur handler on text input
  const handleInputBlur = () => {
    if (!result) return;
    if (editedText.trim() !== result.predicted_text) {
      handleSaveCorrection(editedText.trim());
    }
  };

  // Send to OLED button
  const handleSendToOled = async () => {
    const textToSend = (editedText || result?.predicted_text || '').trim();
    if (!textToSend) return;

    try {
      await sendOledMessage(textToSend);
    } catch (err) {
      console.warn('Backend OLED staging queue error:', err);
    }

    onOpenHardwareModal(textToSend);
  };

  // Clear canvas & reset
  const handleReset = () => {
    canvasRef.current?.clear();
    setResult(null);
    setCapturedImageData(null);
    setRecognitionError(null);
    setFeedbackNotice(null);
    setCurrentRecordId(null);
    setCorrectionStatus('unreviewed');
    setEditedText('');
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Top Banner / Guidance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">
            Handwriting Input Canvas
          </h2>
          <p className="text-xs text-stone-500">
            Draw characters or short words using your finger or stylus. Recognition automatically records to history.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
            Model: TrOCR Base
          </span>
        </div>
      </div>

      {/* Drawing Canvas Area */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <DrawingCanvas
          ref={canvasRef}
          height={260}
          placeholder="Draw your handwriting here (touch or mouse)..."
        />

        {/* Primary Action Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleRecognize}
            disabled={isRecognizing}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRecognizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running TrOCR Inference on CPU...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Recognize Handwriting</span>
              </>
            )}
          </button>

          {(result || capturedImageData) && (
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-sm font-medium transition-colors"
            >
              Start New Drawing
            </button>
          )}
        </div>

        {/* Error message */}
        {recognitionError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="flex-1">{recognitionError}</p>
          </div>
        )}

        {/* Automatic history feedback notice */}
        {feedbackNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{feedbackNotice}</p>
          </div>
        )}
      </div>

      {/* Recognition Result Card */}
      {result && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Recognition Output
                </span>
                <span
                  className={`px-2 py-0.2 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    correctionStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : correctionStatus === 'corrected'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {correctionStatus}
                </span>
              </div>
              <h3 className="text-base font-bold text-navy-900 mt-0.5">
                Model Prediction Result
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-medium text-stone-500">
                {result.inference_time_ms} ms
              </span>
              <span className="block text-[10px] text-stone-400">CPU Latency</span>
            </div>
          </div>

          {/* Editable Prediction Display */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                <Edit2 className="w-3 h-3 text-stone-400" />
                <span>Recognized Text (Editable):</span>
              </label>
              {result.raw_prediction !== result.predicted_text && (
                <span className="text-[11px] text-stone-400 font-mono">
                  raw: "{result.raw_prediction}"
                </span>
              )}
            </div>

            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="Correct text if mistaken..."
                className="w-full px-4 py-3 rounded-xl border border-stone-300 font-mono text-lg font-semibold text-navy-900 focus:outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
              />

              {editedText.trim() !== result.predicted_text && (
                <button
                  type="button"
                  onClick={() => handleSaveCorrection()}
                  disabled={isUpdating}
                  className="shrink-0 px-3 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Save edited correction to existing record"
                >
                  <Check className="w-4 h-4" />
                  <span>Update</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-stone-400">
              Original prediction is preserved. Editing updates this record without creating duplicates.
            </p>
          </div>

          {/* Verification / Confirmation Controls */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-medium text-stone-600 block">
              Confirm or Correct Prediction:
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleConfirmCorrect}
                disabled={isUpdating}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                  correctionStatus === 'verified'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Confirm Prediction</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCorrectionStatus('corrected');
                  if (editedText.trim()) {
                    handleSaveCorrection();
                  }
                }}
                disabled={isUpdating}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                  correctionStatus === 'corrected'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                <span>Mark Corrected</span>
              </button>
            </div>
          </div>

          {/* Action Row: Send to OLED */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <div className="text-[11px] font-mono text-stone-400">
              Record ID: {currentRecordId || '—'}
            </div>

            <button
              type="button"
              onClick={handleSendToOled}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-navy-800 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Send className="w-3.5 h-3.5 text-stone-500" />
              <span>Send to OLED</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
