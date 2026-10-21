import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Upload,
  Info,
} from 'lucide-react';
import { DrawingCanvas } from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import { recognizeHandwriting } from '../services/api';
import { saveRecognitionAttempt, fetchEvaluationStats, importDataset } from '../services/storage';
import type { BackendHealth, HistoryItem, DatasetSplit } from '../types';

interface TrainingScreenProps {
  backendHealth: BackendHealth;
}

export const TrainingScreen: React.FC<TrainingScreenProps> = ({ backendHealth }) => {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evaluation Metrics
  const [stats, setStats] = useState<{
    totalSamples: number;
    correctCount: number;
    accuracy: number;
    trainCount: number;
    testCount: number;
    samples: HistoryItem[];
    isCloud: boolean;
  }>({
    totalSamples: 0,
    correctCount: 0,
    accuracy: 0,
    trainCount: 0,
    testCount: 0,
    samples: [],
    isCloud: false,
  });

  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Active collection state
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [predictedText, setPredictedText] = useState<string>('');
  const [groundTruthText, setGroundTruthText] = useState<string>('');
  const [selectedSplit, setSelectedSplit] = useState<DatasetSplit>('train');
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await fetchEvaluationStats();
      setStats(data);
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRecognize = async () => {
    if (!canvasRef.current || !canvasRef.current.hasStrokes()) {
      setErrorMsg('Draw a sample on the canvas before recognizing.');
      return;
    }

    if (!backendHealth.model_loaded) {
      setErrorMsg('Python backend model is not loaded.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsRecognizing(true);

    try {
      const dataUrl = canvasRef.current.getImageDataUrl();
      setCapturedImageData(dataUrl);

      const res = await recognizeHandwriting(dataUrl);
      setPredictedText(res.predicted_text);
      setGroundTruthText(res.predicted_text);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Evaluation recognition failed');
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSaveLabelledSample = async (markAsCorrect: boolean) => {
    if (!capturedImageData) {
      setErrorMsg('No handwriting image captured.');
      return;
    }

    const finalLabel = groundTruthText.trim();
    if (!finalLabel) {
      setErrorMsg('Please specify the true character or word label.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await saveRecognitionAttempt({
        image_data: capturedImageData,
        predicted_text: predictedText,
        corrected_text: markAsCorrect ? undefined : finalLabel,
        is_correct: markAsCorrect,
        status: markAsCorrect ? 'verified' : 'corrected',
        model_version: backendHealth.model_name || 'microsoft/trocr-base-handwritten',
        split: selectedSplit,
      });

      setSuccessMsg(
        markAsCorrect
          ? `Sample verified as CORRECT ("${predictedText}") in [${selectedSplit.toUpperCase()}] split!`
          : `Sample recorded with label "${finalLabel}" in [${selectedSplit.toUpperCase()}] split!`
      );

      await loadStats();

      // Reset active form
      canvasRef.current?.clear();
      setCapturedImageData(null);
      setPredictedText('');
      setGroundTruthText('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save labelled sample.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export dataset as JSON
  const handleExportDataset = () => {
    if (stats.samples.length === 0) {
      alert('No labelled samples available to export.');
      return;
    }

    const exportPayload = {
      project: 'Tero-Handwriting-Recognition-Dataset',
      exported_at: new Date().toISOString(),
      sample_count: stats.samples.length,
      train_count: stats.trainCount,
      test_count: stats.testCount,
      empirical_accuracy: stats.accuracy,
      samples: stats.samples.map((s) => ({
        id: s.id,
        ground_truth: s.corrected_text || s.predicted_text,
        predicted: s.predicted_text,
        is_correct: s.is_correct,
        status: s.status,
        timestamp: s.timestamp,
        split: s.split || 'train',
        model_version: s.model_version,
        image_data: s.image_data,
      })),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tero_dataset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import dataset from JSON
  const handleImportDataset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = await importDataset(parsed);
      setSuccessMsg(`Successfully imported ${count} labelled samples into IndexedDB!`);
      await loadStats();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to import dataset JSON file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Calculate separate test split accuracy if test samples exist
  const testSamples = stats.samples.filter((s) => s.split === 'test');
  const testCorrect = testSamples.filter((s) => s.is_correct === true).length;
  const testAccuracy = testSamples.length > 0 ? Math.round((testCorrect / testSamples.length) * 1000) / 10 : null;

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-600" />
              Model Evaluation &amp; Dataset Collection
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Collect ground-truth samples, partition into train/test splits, calculate real accuracy, and export for Python training.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDataset}
              disabled={stats.samples.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-navy-900 border border-stone-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download labelled dataset in JSON format"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export (JSON)</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-navy-900 border border-stone-200 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportDataset}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Real Evaluation Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Overall Empirical Accuracy */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
            Overall Accuracy
          </span>
          <div className="flex items-baseline gap-2">
            {isLoadingStats ? (
              <span className="text-2xl font-bold font-mono text-stone-300 animate-pulse">...</span>
            ) : stats.totalSamples === 0 ? (
              <span className="text-2xl font-bold font-mono text-stone-400">N/A</span>
            ) : (
              <span className="text-3xl font-extrabold font-mono text-navy-900">
                {stats.accuracy}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            {stats.totalSamples === 0
              ? 'No labelled samples yet'
              : `${stats.correctCount} of ${stats.totalSamples} correct`}
          </p>
        </div>

        {/* Held-Out Test Set Accuracy */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
            Test Split Accuracy
          </span>
          <div className="flex items-baseline gap-2">
            {testAccuracy === null ? (
              <span className="text-2xl font-bold font-mono text-stone-400">N/A</span>
            ) : (
              <span className="text-3xl font-extrabold font-mono text-brand-600">
                {testAccuracy}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            {stats.testCount === 0 ? 'No test samples' : `${testCorrect} of ${stats.testCount} on held-out test`}
          </p>
        </div>

        {/* Dataset Partition Counts */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
            Partitions (Train / Test)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-navy-900">
              {stats.trainCount}
            </span>
            <span className="text-xs text-stone-400">train /</span>
            <span className="text-2xl font-bold font-mono text-navy-900">
              {stats.testCount}
            </span>
            <span className="text-xs text-stone-400">test</span>
          </div>
          <p className="text-[11px] text-stone-400">
            Total {stats.totalSamples} verified pairs
          </p>
        </div>

        {/* Active Model Stage */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
            Active Model
          </span>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-navy-900 truncate">TrOCR Base</span>
          </div>
          <p className="text-[11px] text-stone-400 truncate">
            {backendHealth.device} &bull; Pretrained weights
          </p>
        </div>
      </div>

      {/* Dataset Collection Canvas & Label Form */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-navy-900">
            Draw &amp; Label a Sample for Evaluation
          </h3>
          <p className="text-xs text-stone-500">
            Draw a character or short word. The system will run TrOCR inference and let you record the confirmed label.
          </p>
        </div>

        <DrawingCanvas
          ref={canvasRef}
          height={220}
          placeholder="Draw a test character or word here..."
        />

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handleRecognize}
            disabled={isRecognizing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-medium text-xs transition-colors shadow-xs disabled:opacity-60"
          >
            {isRecognizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating with TrOCR...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Evaluate Handwriting</span>
              </>
            )}
          </button>
        </div>

        {/* Errors & Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="flex-1">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{successMsg}</p>
          </div>
        )}

        {/* Verification Form (Appears once evaluated) */}
        {capturedImageData && (
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <span className="text-xs font-semibold text-navy-900">
                Ground-Truth Verification
              </span>
              <span className="text-xs font-mono text-stone-500">
                TrOCR Output: <strong className="text-navy-900">"{predictedText}"</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-stone-600 block">
                  Confirmed True Label (Ground Truth):
                </label>
                <input
                  type="text"
                  value={groundTruthText}
                  onChange={(e) => setGroundTruthText(e.target.value)}
                  placeholder="e.g. A, 5, cat, hello..."
                  className="w-full px-3.5 py-2 text-sm font-mono font-semibold rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 block">
                  Dataset Partition:
                </label>
                <select
                  value={selectedSplit}
                  onChange={(e) => setSelectedSplit(e.target.value as DatasetSplit)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium text-stone-700 focus:outline-hidden"
                >
                  <option value="train">Training Set (80%)</option>
                  <option value="test">Testing Set (20%)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSaveLabelledSample(true)}
                disabled={isSaving}
                className="w-full sm:flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Prediction Was Correct</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveLabelledSample(false)}
                disabled={isSaving}
                className="w-full sm:flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Save with Corrected Label</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Machine Learning Pipeline Guidance Card */}
      <div className="p-5 bg-white rounded-2xl border border-stone-200 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-brand-600" />
          ML Engineering Architecture &bull; Pretrained vs Training
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-stone-600 pt-1">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="font-semibold text-navy-900 block">1. Pretrained Inference</span>
            <p className="leading-relaxed">
              The model runs weights pretrained on the IAM Handwriting Database. It performs real-time feedforward inference without altering weights during request execution.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="font-semibold text-navy-900 block">2. Data Collection</span>
            <p className="leading-relaxed">
              When users verify or correct characters, samples are tagged with authentic ground-truth labels and stored in IndexedDB/JSON for dataset building.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="font-semibold text-navy-900 block">3. Future Model Fine-Tuning</span>
            <p className="leading-relaxed">
              The exported dataset is consumed by the Python script in <code className="bg-white px-1 py-0.5 rounded text-navy-900 font-mono">backend/train.py</code> to fine-tune the Vision Transformer on custom strokes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
