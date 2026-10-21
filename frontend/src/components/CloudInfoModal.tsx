import React, { useState, useEffect } from 'react';
import { Cloud, X, ShieldAlert, CheckCircle2, HardDrive, Info, User as UserIcon, LogIn, LogOut, Loader2 } from 'lucide-react';
import { checkFirebaseConfig, subscribeToAuth, loginWithEmail, registerWithEmail, logoutUser, ensureAuthenticated } from '../services/firebase';
import type { User } from 'firebase/auth';

interface CloudInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudInfoModal: React.FC<CloudInfoModalProps> = ({ isOpen, onClose }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const { isConfigured, missingKeys } = checkFirebaseConfig();

  useEffect(() => {
    if (!isOpen || !isConfigured) return;
    const unsub = subscribeToAuth((u) => setCurrentUser(u));
    // Trigger anonymous check if not authenticated
    ensureAuthenticated().then((u) => {
      if (u) setCurrentUser(u);
    });
    return () => unsub();
  }, [isOpen, isConfigured]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!email || !password) return;

    setIsSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
      setAuthSuccess('Signed in successfully! Devices sharing this account sync history in real time.');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!email || !password) {
      setAuthError('Please enter an email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithEmail(email.trim(), password);
      setAuthSuccess('Account created! Use these credentials to sign in on your phone and laptop.');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
    setCurrentUser(null);
    setAuthSuccess('Signed out.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>
              {isConfigured ? <Cloud className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900 leading-tight">
                {isConfigured ? 'Cloud Sync & Device Sharing' : 'Local Persistence (Zero-Cost Default)'}
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                {isConfigured ? 'Status: Firestore Connected' : 'Status: IndexedDB Active (No cloud account needed)'}
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

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-stone-600">
          {/* Status Alert */}
          {isConfigured ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-900 block">Cloud Sync Active (Spark Free Tier)</span>
                <p className="text-emerald-800 text-xs mt-0.5">
                  Recognition metadata, text predictions, and corrections synchronize in real time between your laptop and phone via Cloud Firestore.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 flex items-start gap-2.5">
              <HardDrive className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-navy-900 block">Browser IndexedDB Active (100% Free &amp; Offline)</span>
                <p className="text-stone-600 text-xs mt-0.5 leading-relaxed">
                  Your handwriting samples, labels, and corrections are stored in browser <strong>IndexedDB</strong>. It survives page refreshes, has ample storage quota, requires ₹0, and needs zero cloud configuration.
                </p>
              </div>
            </div>
          )}

          {/* Phone & Laptop Sharing Section */}
          {isConfigured && (
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy-900 flex items-center gap-1.5 text-xs">
                  <UserIcon className="w-3.5 h-3.5 text-brand-600" />
                  Account for Phone &amp; Laptop Sync
                </span>
                {currentUser && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    {currentUser.isAnonymous ? 'Anonymous Auth' : currentUser.email}
                  </span>
                )}
              </div>

              {currentUser && !currentUser.isAnonymous ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-stone-500">
                    Logged in as <strong>{currentUser.email}</strong>
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-white border border-stone-300 text-stone-700 hover:bg-stone-100"
                  >
                    <LogOut className="w-3 h-3" /> Sign Out
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-2 pt-1">
                  <p className="text-[11px] text-stone-500">
                    Log into the same account on your phone and laptop to securely share and update the same handwriting history.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email (e.g. student@college.edu)"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                    />
                  </div>

                  {authError && <p className="text-[11px] text-rose-600 font-medium">{authError}</p>}
                  {authSuccess && <p className="text-[11px] text-emerald-600 font-medium">{authSuccess}</p>}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-1.5 px-3 bg-navy-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-navy-800 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={isSubmitting}
                      className="flex-1 py-1.5 px-3 bg-white border border-stone-300 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50 disabled:opacity-50"
                    >
                      <span>Create Account</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Local vs Cloud Image Note */}
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-2 text-stone-600">
            <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Zero-Cost Image Policy:</strong> To keep this project 100% on the no-cost Spark plan without billing, handwriting stroke images are kept in <strong>IndexedDB</strong> on the device where they were drawn. Predictions, corrections, timestamps, and status sync across all devices via Firestore.
            </p>
          </div>

          {/* Configuration Keys Status */}
          <div className="space-y-2">
            <h4 className="font-semibold text-navy-900 text-xs uppercase tracking-wider text-stone-500">
              Environment Variables Status
            </h4>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 font-mono text-[11px] space-y-1.5">
              {[
                'VITE_FIREBASE_API_KEY',
                'VITE_FIREBASE_PROJECT_ID',
                'VITE_FIREBASE_APP_ID',
              ].map((key) => {
                const isMissing = missingKeys.includes(key);
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-stone-600">{key}:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        isMissing
                          ? 'bg-stone-200 text-stone-600'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isMissing ? 'Not Set (Optional)' : 'Configured'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Note */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 leading-relaxed">
              <strong>Security Architecture:</strong> Firestore security rules (see <code className="bg-white px-1 py-0.5 rounded text-blue-950 font-mono">firebase/firestore.rules</code>) require authentication (<code className="bg-white px-1 py-0.5 rounded font-mono">request.auth != null</code>) to prevent public internet access.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-navy-900 text-white hover:bg-navy-800 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
