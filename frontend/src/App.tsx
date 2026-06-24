import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldAlert, Zap, Layers, ServerCrash, DollarSign, Users } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function App() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [unresolved, setUnresolved] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [quarantines, setQuarantines] = useState<any[]>([]);
  const [pulsingEventId, setPulsingEventId] = useState<number | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/stream`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data.metrics);
      setUnresolved(data.unresolved);
      
      setLogs((prevLogs) => {
        // Find if there are new logs to trigger animations
        if (prevLogs.length > 0 && data.logs.length > 0 && prevLogs[0].sequence_id !== data.logs[0].sequence_id) {
          setPulsingEventId(data.logs[0].sequence_id);
          setTimeout(() => setPulsingEventId(null), 1000);
        }
        return data.logs;
      });
      
      setQuarantines(data.quarantines);
    };

    return () => eventSource.close();
  }, []);

  const totalCost = metrics.length > 0 ? metrics[0].total_cost : 0;
  const unresolvedCost = unresolved?.total_cost || 0;

  const handleAction = async (endpoint: string) => {
    try {
      await fetch(`${API_BASE}/actions/${endpoint}`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8">
      <header className="flex items-center gap-4 border-b border-slate-800 pb-6">
        <Zap className="text-cyan-400 w-8 h-8" />
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Eventual AI
        </h1>
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Live SSE Connection
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Metrics Row */}
        <motion.div 
          key={totalCost}
          initial={{ scale: 1.05, color: '#22d3ee' }}
          animate={{ scale: 1, color: '#f8fafc' }}
          className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-center items-center"
        >
          <div className="text-slate-400 mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4"/> Attributed Spend</div>
          <div className="text-4xl font-mono">${(totalCost || 0).toFixed(2)}</div>
        </motion.div>

        <motion.div 
          key={unresolvedCost}
          initial={{ scale: 1.05, color: '#fb923c' }}
          animate={{ scale: 1, color: '#f8fafc' }}
          className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-center items-center"
        >
          <div className="text-orange-400/80 mb-2 flex items-center gap-2"><Users className="w-4 h-4"/> Unresolved Spend</div>
          <div className="text-4xl font-mono text-orange-400">${(unresolvedCost || 0).toFixed(2)}</div>
        </motion.div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-center items-center">
          <div className="text-slate-400 mb-2 flex items-center gap-2"><Activity className="w-4 h-4"/> System Events</div>
          <div className="text-4xl font-mono">{logs.length > 0 ? logs[0].sequence_id : 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Control Panel */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-slate-300 mb-2">Stress Controls</h2>
          
          <button onClick={() => handleAction('inject-redelivered')} className="group flex flex-col text-left bg-slate-900/50 hover:bg-slate-800 border border-slate-800 p-4 rounded-xl transition-all">
            <div className="flex items-center gap-2 font-medium text-blue-400 mb-1"><Layers className="w-4 h-4"/> Inject Redelivery</div>
            <p className="text-sm text-slate-500 group-hover:text-slate-300">Fires the same event twice. Watch the log swallow the duplicate idempotently.</p>
          </button>

          <button onClick={() => handleAction('inject-drifted')} className="group flex flex-col text-left bg-slate-900/50 hover:bg-red-900/20 border border-slate-800 hover:border-red-900/50 p-4 rounded-xl transition-all">
            <div className="flex items-center gap-2 font-medium text-red-400 mb-1"><ServerCrash className="w-4 h-4"/> Inject Schema Drift</div>
            <p className="text-sm text-slate-500 group-hover:text-slate-300">Sends a payload with wrong types. Watch it route to quarantine.</p>
          </button>

          <button onClick={() => handleAction('backfill-cost')} className="group flex flex-col text-left bg-slate-900/50 hover:bg-emerald-900/20 border border-slate-800 hover:border-emerald-900/50 p-4 rounded-xl transition-all">
            <div className="flex items-center gap-2 font-medium text-emerald-400 mb-1"><DollarSign className="w-4 h-4"/> Backfill Late Cost</div>
            <p className="text-sm text-slate-500 group-hover:text-slate-300">Ingests event, then 2s later backfills cost. Watch top metric tick up.</p>
          </button>

          <button onClick={() => handleAction('unresolved-identity')} className="group flex flex-col text-left bg-slate-900/50 hover:bg-orange-900/20 border border-slate-800 hover:border-orange-900/50 p-4 rounded-xl transition-all">
            <div className="flex items-center gap-2 font-medium text-orange-400 mb-1"><Users className="w-4 h-4"/> Add Unresolved Identity</div>
            <p className="text-sm text-slate-500 group-hover:text-slate-300">Adds spend to unknown user, then resolves identity 3s later.</p>
          </button>
        </div>

        {/* Live Event Log */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-slate-300 mb-2">Live Event Log</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[400px] flex flex-col">
            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              <AnimatePresence>
                {logs.map((log) => (
                  <motion.div
                    key={log.sequence_id}
                    initial={{ opacity: 0, x: -20, backgroundColor: '#1e293b' }}
                    animate={{ 
                      opacity: 1, 
                      x: 0, 
                      backgroundColor: pulsingEventId === log.sequence_id ? '#0f172a' : '#0f172a'
                    }}
                    transition={{ duration: 0.3 }}
                    className="p-4 border border-slate-800 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-slate-500">#{log.sequence_id}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold
                          ${log.action === 'INGEST' ? 'bg-blue-500/10 text-blue-400' : ''}
                          ${log.action === 'UPDATE_COST' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                          ${log.action === 'RESOLVE_IDENTITY' ? 'bg-purple-500/10 text-purple-400' : ''}
                        `}>
                          {log.action}
                        </span>
                        <span className="text-sm text-slate-400 font-mono truncate max-w-[150px]">{log.dedup_key}</span>
                      </div>
                      <div className="text-xs font-mono text-slate-500 truncate w-full">
                        {JSON.stringify(log.delta)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Quarantine Lane */}
          <AnimatePresence>
            {quarantines.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4"
              >
                <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl">
                  <h3 className="text-red-400 font-medium flex items-center gap-2 mb-3"><ShieldAlert className="w-5 h-5"/> Quarantined Payloads</h3>
                  <div className="flex flex-col gap-2">
                    {quarantines.map(q => (
                      <div key={q.id} className="bg-black/40 border border-red-900/30 p-3 rounded text-sm text-slate-300 font-mono">
                        <div className="text-red-400 mb-1">{q.error_reason}</div>
                        <div className="text-xs text-slate-500 truncate">{JSON.stringify(q.payload)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
