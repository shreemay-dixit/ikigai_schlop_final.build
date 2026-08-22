'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { Diagnostics } from '@/lib/diagnostics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { AlertTriangle, Wifi, WifiOff, XCircle, RefreshCw } from 'lucide-react';

interface DiagnosticError {
  level: string;
  message: string;
  context?: any;
  error?: any;
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  diagnosticErrors: DiagnosticError[];
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, diagnosticErrors: [] };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, diagnosticErrors: [] };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Diagnostics.error('React Component crashed', { component: 'ErrorBoundary', errorInfo }, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-slate-100">
          <div className="max-w-2xl w-full bg-slate-900 border border-red-900/50 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <XCircle className="w-10 h-10" />
              <h1 className="text-3xl font-bold tracking-tight">Critical System Failure</h1>
            </div>
            
            <p className="text-slate-400 mb-6 text-lg">
              A fatal error was caught by the System Health Provider. Execution has been halted to prevent silent degradation.
            </p>
            
            <div className="bg-slate-950 rounded-xl p-6 font-mono text-sm border border-slate-800 overflow-auto max-h-64 mb-6">
              <div className="text-red-400 font-semibold mb-2">{this.state.error?.message}</div>
              <div className="text-slate-500 whitespace-pre-wrap">{this.state.error?.stack}</div>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-100 text-slate-950 px-6 py-3 rounded-xl font-semibold hover:bg-white transition-colors"
            >
              Restart System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function SystemHealthProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<DiagnosticError[]>([]);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  useEffect(() => {
    // 1. Top-level unhandled promise rejection listener
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      Diagnostics.error('Unhandled Promise Rejection', { component: 'Window' }, event.reason);
      setAlerts(prev => [...prev, { level: 'error', message: event.reason?.message || 'Unhandled Rejection', error: event.reason }]);
      event.preventDefault();
    };

    // 2. Custom diagnostic event listener
    const handleDiagnosticError = (event: Event) => {
      const customEvent = event as CustomEvent<DiagnosticError>;
      setAlerts(prev => [...prev, customEvent.detail]);
    };

    // 3. Global error listener
    const handleGlobalError = (event: ErrorEvent) => {
      Diagnostics.error('Global Error Caught', { component: 'Window' }, event.error);
      setAlerts(prev => [...prev, { level: 'error', message: event.message, error: event.error }]);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('fillwell-diagnostic-error', handleDiagnosticError);
    window.addEventListener('error', handleGlobalError);

    // 4. Pre-flight Environment Validation Check
    const runPreflightChecks = () => {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!sbUrl || !sbKey || sbUrl.includes('placeholder')) {
        const msg = 'CRITICAL: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or unconfigured.';
        Diagnostics.error(msg, { component: 'SystemHealthProvider' });
        setAlerts(prev => [...prev, { level: 'fatal', message: msg }]);
        if (typeof window !== 'undefined') {
          // Visible alert as required by Phase 1 specification
          console.warn('[Environment Validation Alert]:', msg);
        }
      }
    };

    runPreflightChecks();

    // 5. Supabase Realtime Socket Diagnostics & Health Ping
    let channel: any = null;
    let isSubscribed = false;

    const verifyRestHealth = async () => {
      try {
        const res = await fetch('/api/organization');
        if (res.ok) {
          setSocketStatus('connected');
        } else {
          setSocketStatus('disconnected');
        }
      } catch {
        setSocketStatus('disconnected');
      }
    };

    try {
      channel = supabase.channel('system-health-diagnostics', {
        config: { broadcast: { self: true } }
      });

      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          setSocketStatus('connected');
          Diagnostics.info('Supabase Realtime WebSocket connected successfully.', { component: 'RealtimeSocket' });
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // If WebSocket encounters key format issue, verify REST endpoint health
          await verifyRestHealth();
          Diagnostics.warn(`Supabase Realtime WebSocket state: ${status}. Checked REST connection health.`, { component: 'RealtimeSocket' });
        } else {
          setSocketStatus('connecting');
        }
      });
    } catch (e) {
      verifyRestHealth();
      Diagnostics.warn('Could not initialize Supabase Realtime channel.', { component: 'RealtimeSocket', error: e });
    }

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('fillwell-diagnostic-error', handleDiagnosticError);
      window.removeEventListener('error', handleGlobalError);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const dismissAlert = (index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <ErrorBoundary>
      {/* Top Banner: Realtime Reconnecting or Offline Notice */}
      {socketStatus === 'disconnected' && (
        <div className="sticky top-0 z-50 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-300 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Realtime Socket Disconnected &bull; Reconnecting to Supabase...</span>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="underline text-amber-200 hover:text-white"
          >
            Force Refresh
          </button>
        </div>
      )}

      {children}

      {/* Floating System Status Pill in bottom left */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md text-[11px] font-mono">
        {socketStatus === 'connected' ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300">Socket: <strong className="text-emerald-400">Connected</strong></span>
          </>
        ) : socketStatus === 'connecting' ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="text-slate-300">Socket: <strong className="text-amber-400">Connecting...</strong></span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-slate-300">Socket: <strong className="text-rose-400">Disconnected</strong></span>
          </>
        )}
      </div>

      {/* Toast Overlay for runtime telemetry alerts */}
      {alerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
          {alerts.map((alert, idx) => (
            <div key={idx} className="bg-slate-900 border border-red-900/50 shadow-2xl rounded-xl p-4 flex gap-3 text-sm text-slate-200 animate-in slide-in-from-right-4">
              {alert.level === 'fatal' ? (
                <WifiOff className="w-5 h-5 text-red-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-slate-100 mb-1">
                  {alert.level === 'fatal' ? 'Fatal Diagnostic Error' : 'Diagnostic Alert'}
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">{alert.message}</div>
              </div>
              <button 
                onClick={() => dismissAlert(idx)}
                className="text-slate-500 hover:text-slate-300 self-start"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </ErrorBoundary>
  );
}
