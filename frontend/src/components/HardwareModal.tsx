import React from 'react';
import { WifiOff, AlertTriangle, X } from 'lucide-react';

interface HardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagedText?: string;
}

export const HardwareModal: React.FC<HardwareModalProps> = ({
  isOpen,
  onClose,
  stagedText,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-stone-200 text-stone-700">
              <WifiOff className="w-5 h-5 text-stone-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900 leading-tight">
                ESP32 &bull; OLED Hardware Status
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                Status: Not connected (Hardware Offline)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-stone-600">
          {stagedText && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-900 block">
                    Message Queued for Display (Not Yet Rendered)
                  </span>
                  <p className="text-amber-800 text-xs mt-0.5">
                    Text <span className="font-mono font-bold">"{stagedText}"</span> was queued to the staging endpoint, but cannot be physically displayed because the physical ESP32 microcontroller is currently offline.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-semibold text-navy-900 text-xs uppercase tracking-wider text-stone-500">
              Hardware Architecture Overview
            </h4>
            <p className="leading-relaxed">
              In this engineering project, the recognized handwriting is transmitted to a physical <strong>ESP32 microcontroller</strong> connected to a <strong>0.96" SSD1306 I2C OLED display (128&times;64)</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2 font-mono text-[11px]">
            <div className="flex justify-between border-b border-stone-200 pb-1">
              <span className="text-stone-500">Target Microcontroller:</span>
              <span className="font-semibold text-navy-900">ESP32-WROOM-32</span>
            </div>
            <div className="flex justify-between border-b border-stone-200 pb-1">
              <span className="text-stone-500">Display:</span>
              <span className="font-semibold text-navy-900">SSD1306 OLED (128x64, I2C 0x3C)</span>
            </div>
            <div className="flex justify-between border-b border-stone-200 pb-1">
              <span className="text-stone-500">Firmware Source:</span>
              <span className="text-brand-600 font-semibold">/esp32/main.ino</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Staging Endpoint:</span>
              <span className="text-navy-800 font-semibold">/api/oled/message</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-semibold text-navy-900 text-xs uppercase tracking-wider text-stone-500">
              Hardware Checklist Required Before Testing:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-stone-600 pl-1">
              <li>Confirm physical OLED display driver (SSD1306 vs SH1106).</li>
              <li>Verify I2C wiring: SDA &rarr; GPIO 21, SCL &rarr; GPIO 22, VCC 3.3V, GND.</li>
              <li>Configure Wi-Fi SSID &amp; Password in <code className="bg-stone-100 px-1 py-0.5 rounded text-navy-900">esp32/main.ino</code>.</li>
              <li>Ensure ESP32 can reach the backend IP address on local network.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-navy-900 text-white hover:bg-navy-800 transition-colors shadow-xs"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
