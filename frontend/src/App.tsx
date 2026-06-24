import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldAlert, Zap, Layers, ServerCrash, DollarSign, Users, BarChart2, Table, MessageSquare, Send, X, Code, Key } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from 'recharts';

const API_BASE = 'http://localhost:3001/api';

export default function App() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [unresolved, setUnresolved] = useState<any>(null);
  const [perTool, setPerTool] = useState<any[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [quarantines, setQuarantines] = useState<any[]>([]);
  const [pulsingEventId, setPulsingEventId] = useState<number | null>(null);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'bot', text: string}[]>([{ role: 'bot', text: 'Hi! I am your FinOps Copilot. You can ask me about your current spend, limits, or budgets.' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/stream`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data.metrics || []);
      setUnresolved(data.unresolved);
      setPerTool(data.perTool || []);
      setMonthlyTrends(data.monthlyTrends || []);
      
      setLogs((prevLogs) => {
        if (prevLogs.length > 0 && data.logs.length > 0 && prevLogs[0].sequence_id !== data.logs[0].sequence_id) {
          setPulsingEventId(data.logs[0].sequence_id);
          setTimeout(() => setPulsingEventId(null), 1000);
        }
        return data.logs;
      });
      
      setQuarantines(data.quarantines || []);
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const totalCost = metrics.length > 0 ? metrics[0].total_cost : 0;
  const unresolvedCost = unresolved?.total_cost || 0;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'bot', text: data.response }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Error connecting to the AI backend.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const chartColors = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 text-white font-sans pb-24">
      <header className="flex items-center gap-4 border-b border-wet-asphalt/50 pb-6 relative">
        <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.5)]">
          <Zap className="text-white w-8 h-8" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-md">
          Eventual AI Production
        </h1>
        <div className="ml-auto flex items-center gap-3 text-sm font-bold bg-emerald-500/10 text-emerald-400 px-5 py-2.5 rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          System Live
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Metrics Row */}
        <motion.div 
          key={totalCost}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.03, y: -4 }}
          className="relative overflow-hidden bg-gradient-to-br from-midnight-blue to-[#1e2e3e] border border-cyan-500/30 p-8 rounded-3xl shadow-[0_10px_30px_rgba(34,211,238,0.15)] flex flex-col justify-center transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-24 h-24 text-cyan-400" />
          </div>
          <div className="text-cyan-200 mb-3 flex items-center gap-2 font-bold tracking-widest uppercase text-sm">
            <DollarSign className="w-5 h-5 text-cyan-400"/> Attributed Spend
          </div>
          <div className="text-6xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            ${(totalCost || 0).toFixed(2)}
          </div>
        </motion.div>

        <motion.div 
          key={unresolvedCost}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.03, y: -4 }}
          className="relative overflow-hidden bg-gradient-to-br from-midnight-blue to-[#1e2e3e] border border-amber-500/30 p-8 rounded-3xl shadow-[0_10px_30px_rgba(251,191,36,0.15)] flex flex-col justify-center transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Users className="w-24 h-24 text-amber-400" />
          </div>
          <div className="text-amber-200 mb-3 flex items-center gap-2 font-bold tracking-widest uppercase text-sm">
            <Users className="w-5 h-5 text-amber-400"/> Unresolved Spend
          </div>
          <div className="text-6xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
            ${(unresolvedCost || 0).toFixed(2)}
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.03, y: -4 }}
          className="relative overflow-hidden bg-gradient-to-br from-midnight-blue to-[#1e2e3e] border border-purple-500/30 p-8 rounded-3xl shadow-[0_10px_30px_rgba(167,139,250,0.15)] flex flex-col justify-center transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="w-24 h-24 text-purple-400" />
          </div>
          <div className="text-purple-200 mb-3 flex items-center gap-2 font-bold tracking-widest uppercase text-sm">
            <Activity className="w-5 h-5 text-purple-400"/> Total Events Processed
          </div>
          <div className="text-6xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]">
            {logs.length > 0 ? logs[0].sequence_id : 0}
          </div>
        </motion.div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 gap-8">
        {/* Monthly Trend Chart */}
        <motion.div whileHover={{ scale: 1.01 }} className="bg-gradient-to-b from-midnight-blue to-[#1a252f] border-t-[4px] border-t-purple-500 border-l border-r border-b border-wet-asphalt rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg"><Activity className="w-6 h-6 text-purple-400" /></div> 
            Monthly Spend Summary (Trends)
          </h2>
          <div className="h-[280px] w-full relative">
            <ResponsiveContainer width="99%" height="100%">
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="4 4" stroke="#34495e" vertical={false} />
                <XAxis dataKey="month" stroke="#95a5a6" axisLine={false} tickLine={false} dy={15} tick={{ fill: '#e2e8f0', fontWeight: 'bold' }} />
                <YAxis stroke="#95a5a6" axisLine={false} tickLine={false} dx={-15} tick={{ fill: '#94a3b8' }} />
                <RechartsTooltip 
                  cursor={{ stroke: '#34495e', strokeWidth: 2 }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #a855f7', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} 
                  itemStyle={{ color: '#c084fc', fontWeight: 'bold', fontSize: '1.1rem' }}
                />
                <Line type="monotone" dataKey="total_cost" name="Cost ($)" stroke="#a855f7" strokeWidth={4} dot={{ r: 6, fill: '#1e293b', stroke: '#a855f7', strokeWidth: 2 }} activeDot={{ r: 8 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            {monthlyTrends.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-asbestos italic">Awaiting monthly data points...</div>}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div whileHover={{ scale: 1.01 }} className="bg-gradient-to-b from-midnight-blue to-[#1a252f] border-t-[4px] border-t-cyan-500 border-l border-r border-b border-wet-asphalt rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg"><BarChart2 className="w-6 h-6 text-cyan-400" /></div> 
            Spend Separated by App
          </h2>
          <div className="h-[280px] w-full relative">
            <ResponsiveContainer width="99%" height="100%">
              <BarChart data={perTool}>
                <CartesianGrid strokeDasharray="4 4" stroke="#34495e" vertical={false} />
                <XAxis dataKey="vendor" stroke="#95a5a6" axisLine={false} tickLine={false} dy={15} tick={{ fill: '#e2e8f0', fontWeight: 'bold' }} />
                <YAxis stroke="#95a5a6" axisLine={false} tickLine={false} dx={-15} tick={{ fill: '#94a3b8' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#34495e', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #38bdf8', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} 
                  itemStyle={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.1rem' }}
                />
                <Bar dataKey="total_cost" name="Cost ($)" radius={[8, 8, 0, 0]} barSize={40} isAnimationActive={false}>
                  {perTool.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.01 }} className="bg-gradient-to-b from-midnight-blue to-[#1a252f] border-t-[4px] border-t-emerald-500 border-l border-r border-b border-wet-asphalt rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg"><Table className="w-6 h-6 text-emerald-400" /></div>
            App Usage Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-wet-asphalt text-concrete font-bold text-sm uppercase tracking-wider">
                  <th className="py-4">Vendor</th>
                  <th className="py-4">Product</th>
                  <th className="py-4 text-right">Cost</th>
                  <th className="py-4 text-right">Tokens</th>
                  <th className="py-4 text-right">Reqs</th>
                </tr>
              </thead>
              <tbody>
                {perTool.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-asbestos italic font-medium">No data yet. Webhook listening!</td></tr>
                ) : (
                  perTool.map((tool, idx) => (
                    <tr key={idx} className="border-b border-wet-asphalt/40 text-sm hover:bg-wet-asphalt/30 transition-colors">
                      <td className="py-5 font-bold text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors[idx % chartColors.length] }}></div>
                        {tool.vendor}
                      </td>
                      <td className="py-5 text-concrete font-medium">{tool.product}</td>
                      <td className="py-5 text-right font-mono font-bold text-cyan-400">${(tool.total_cost || 0).toFixed(2)}</td>
                      <td className="py-5 text-right font-mono text-emerald-400 font-medium">{tool.total_tokens || 0}</td>
                      <td className="py-5 text-right font-mono text-purple-400 font-medium">{tool.total_requests || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Live Event Log */}
        <div className="flex flex-col gap-5">
          <h2 className="text-2xl font-black text-white mb-1 tracking-wide">Live Canonical Log</h2>
          <div className="bg-midnight-blue border-[3px] border-wet-asphalt rounded-3xl overflow-hidden shadow-2xl h-[450px] flex flex-col relative">
            
            <div className="overflow-y-auto p-6 flex flex-col gap-4 relative z-10">
              <AnimatePresence>
                {logs.map((log) => (
                  <motion.div
                    key={log.sequence_id}
                    initial={{ opacity: 0, x: -30, scale: 0.9 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0, 
                      scale: 1,
                      backgroundColor: pulsingEventId === log.sequence_id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                      borderColor: pulsingEventId === log.sequence_id ? '#38bdf8' : '#34495e'
                    }}
                    transition={{ duration: 0.5, type: "spring", bounce: 0.5 }}
                    className="p-5 border-l-[6px] border border-r-0 border-t-0 border-b-0 rounded-xl flex items-center justify-between backdrop-blur-md shadow-lg"
                    style={{ borderLeftColor: log.action === 'INGEST' ? '#3b82f6' : log.action === 'UPDATE_COST' ? '#10b981' : '#f59e0b' }}
                  >
                    <div className="w-full">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-sm font-mono text-concrete font-black bg-black/30 px-2 py-1 rounded">#{log.sequence_id}</span>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-black uppercase tracking-widest shadow-md bg-blue-500 text-white`}>
                          {log.action}
                        </span>
                        <span className="text-sm text-cyan-200 font-mono font-medium truncate flex-1 opacity-80">{log.dedup_key}</span>
                      </div>
                      <div className="text-sm font-mono text-emerald-200 truncate w-full bg-black/40 p-3 rounded-xl border border-white/10 shadow-inner">
                        {JSON.stringify(log.delta)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chatbot Widget */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-midnight-blue border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.2)] rounded-3xl w-96 h-[500px] mb-4 flex flex-col overflow-hidden"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-4 flex justify-between items-center text-white">
                <div className="font-bold flex items-center gap-3">
                  <img 
                    src="/robot_nobg.png" 
                    alt="Avatar"
                    className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                  />
                  FinOps AI Copilot
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#111827]">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-cyan-500/20 text-cyan-50 self-end rounded-tr-none border border-cyan-500/30' : 'bg-wet-asphalt text-concrete self-start rounded-tl-none border border-white/10'}`}>
                    {msg.text}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="bg-wet-asphalt text-concrete self-start rounded-2xl rounded-tl-none border border-white/10 p-3 text-sm flex gap-1">
                    <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '100ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '200ms'}}>.</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-3 bg-midnight-blue border-t border-white/10 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about rate limits, budgets..." 
                  className="flex-1 bg-black/30 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
                <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="bg-cyan-500 hover:bg-cyan-400 text-midnight-blue p-2 rounded-full transition-colors disabled:opacity-50">
                  <Send className="w-5 h-5"/>
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{ y: [0, -15, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative w-48 h-48 z-50 focus:outline-none"
        >
          {isChatOpen && (
            <div className="absolute -top-4 right-8 bg-cyan-500 text-midnight-blue p-2 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)] z-10 transition-colors hover:bg-cyan-400">
              <X className="w-6 h-6"/>
            </div>
          )}
          <img 
            src="/robot_nobg.png" 
            alt="Robot Mascot" 
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]" 
          />
        </motion.button>
      </div>

    </div>
  );
}
