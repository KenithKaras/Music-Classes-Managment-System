import React from 'react';
import { Database, AlertTriangle, RefreshCw, FileCode2 } from 'lucide-react';
import type { SchemaValidationResult } from '../utils/schemaChecker';

interface SchemaErrorScreenProps {
  schemaResult: SchemaValidationResult;
  onRetry: () => void;
}

export const SchemaErrorScreen: React.FC<SchemaErrorScreenProps> = ({
  schemaResult,
  onRetry,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 antialiased font-sans text-slate-100">
      <div className="max-w-2xl w-full bg-[#131c2e] rounded-2xl shadow-2xl border border-rose-500/30 p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Database Migration Incomplete
            </h1>
            <p className="text-xs text-rose-300 mt-0.5">
              Development Check: Missing database tables or schema columns detected.
            </p>
          </div>
        </div>

        {schemaResult.missingTables.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Missing Tables ({schemaResult.missingTables.length}):
            </h2>
            <ul className="grid grid-cols-2 gap-2 text-xs font-mono">
              {schemaResult.missingTables.map((t) => (
                <li key={t} className="p-2 rounded bg-black/40 border border-rose-800/40 text-rose-200">
                  public.{t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {schemaResult.missingColumns.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-900/60 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5" />
              Missing Columns ({schemaResult.missingColumns.length}):
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {schemaResult.missingColumns.map((c) => (
                <li key={`${c.table}.${c.column}`} className="p-2 rounded bg-black/40 border border-amber-800/40 text-amber-200">
                  {c.table}.{c.column}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3 text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <p className="font-semibold text-white">How to apply database migrations:</p>
          <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
            <li>Open the Supabase dashboard for your project.</li>
            <li>Go to the <strong>SQL Editor</strong> tab.</li>
            <li>
              Execute migrations in order from <code className="text-indigo-400">001_phase1.sql</code> through <code className="text-indigo-400">010_scale_and_performance.sql</code>.
            </li>
          </ol>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            Recheck Database Schema
          </button>
        </div>
      </div>
    </div>
  );
};
