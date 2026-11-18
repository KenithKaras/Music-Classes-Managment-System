import React from 'react';
import { AlertOctagon, Terminal, RefreshCw } from 'lucide-react';

interface SetupErrorScreenProps {
  missingVars: string[];
}

export const SetupErrorScreen: React.FC<SetupErrorScreenProps> = ({ missingVars }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 antialiased font-sans">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-300 p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertOctagon className="w-6 h-6" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Configuration Error: Missing Environment Variables
        </h1>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          The application cannot start because required Supabase configuration is missing or incomplete.
        </p>

        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-800">
            Missing / Unconfigured Variable{missingVars.length > 1 ? 's' : ''}:
          </p>
          <ul className="mt-2 space-y-1">
            {missingVars.map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm font-mono font-medium text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {v}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-3 text-xs sm:text-sm text-slate-600">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-500" />
            How to resolve:
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-slate-600">
            <li>
              Open your <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">.env</code> file in the project root.
            </li>
            <li>
              Log into your Supabase Dashboard → <strong>Project Settings</strong> → <strong>API</strong>.
            </li>
            <li>
              Copy the <strong>Project URL</strong> and <strong>anon / public key</strong> into your <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">.env</code> file:
              <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
              </pre>
            </li>
            <li className="text-amber-800 font-medium">
              <strong>Important:</strong> Restart the development server (<code className="bg-amber-100 px-1 rounded font-mono">npm run dev</code>) after modifying <code className="bg-amber-100 px-1 rounded font-mono">.env</code> so Vite loads the new variables.
            </li>
          </ol>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};
