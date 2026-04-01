import React, { useState, useEffect } from 'react';
import { CalendarDays, ShoppingBag, Clock, CheckCircle2, User, RefreshCw, X, Receipt, TrendingUp, TrendingDown, Trash2, Tag, Sparkles, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Edit3, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent, Modal } from '../components/ui';

interface Session {
  id: string;
  customer_id: string;
  user_code: string;
  phone_number: string;
  start_time: string;
  end_time?: string;
  status: string;
  catering_amount: number;
  orders: any[];
  total_minutes?: number;
  total_amount?: number;
  payment_method?: string;
  notes?: string;
  customers?: { 
    full_name: string,
    code: string,
    subscriptions?: any[]
  };
}

// Helper Component for Desktop Table Row
const SessionRow = ({ session, onEdit, onDelete }: { 
  key?: string, 
  session: Session, 
  onEdit: (s: Session) => void, 
  onDelete: (id: string) => void | Promise<void> 
}) => {
  const activeSub = session.customers?.subscriptions?.find((s: any) => 
    s.status === 'Active' && 
    new Date(s.end_date) >= new Date() &&
    s.used_hours < s.total_hours
  );

  return (
    <tr className="hover:bg-slate-50/40 transition-all font-bold group duration-500">
      <td className="px-10 py-8">
         <div className="flex flex-row-reverse items-start gap-4 text-right">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 lg:group-hover:bg-indigo-50 lg:group-hover:text-indigo-500 transition-all duration-500">
               <User size={20} />
            </div>
            <div className="text-right">
               <p className="text-slate-800 font-black text-base lg:group-hover:text-indigo-600 transition-colors">
                  {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم')}
               </p>
               <div className="flex flex-row-reverse items-center justify-start gap-3 mt-2">
                  <span className="text-[10px] text-indigo-500 font-black bg-indigo-50 px-2 py-0.5 rounded-lg">{session.user_code}</span>
                  {activeSub && (
                     <div className="flex flex-row-reverse items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Sparkles size={10} className="animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Subscribed</span>
                     </div>
                  )}
               </div>
            </div>
            {session.notes && (
               <div className="mt-4 px-3 py-1.5 bg-amber-50/50 border border-amber-100/50 rounded-xl flex items-start gap-2 max-w-[180px] group-hover:bg-amber-50 transition-all self-end">
                  <Edit3 size={10} className="text-amber-400 mt-1 shrink-0" />
                  <p className="text-[9px] text-amber-700 font-bold italic line-clamp-2 text-right w-full">{session.notes}</p>
               </div>
            )}
         </div>
      </td>

      <td className="px-6 py-8">
        <div className="flex items-center justify-center gap-3">
          <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl shadow-sm text-center">
            <span className="text-[8px] text-slate-400 uppercase tracking-widest block font-black mb-1">IN</span>
            <span className="text-slate-700 font-mono text-xs font-black">
              {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })}
            </span>
          </div>
          <ChevronLeft size={16} className="text-slate-200" />
          <div className={`px-4 py-2 rounded-2xl border text-center ${session.end_time ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <span className={`text-[8px] uppercase tracking-widest block font-black mb-1 ${session.end_time ? 'text-slate-400' : 'text-emerald-500'}`}>{session.end_time ? 'OUT' : 'NOW'}</span>
            <span className={`font-mono text-xs font-black ${session.end_time ? 'text-slate-700' : 'text-emerald-600'}`}>
              {session.end_time ? new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : 'ACTIVE'}
            </span>
          </div>
        </div>
      </td>

      <td className="px-6 py-8 text-center">
        {session.catering_amount > 0 ? (
          <div className="bg-amber-50/50 border border-amber-100 inline-block px-5 py-3 rounded-[1.5rem] lg:group-hover:bg-amber-50 transition-all text-right">
             <div className="flex items-center gap-2 justify-center text-amber-600 mb-1">
                <ShoppingBag size={14} />
                <span className="text-sm font-black">{session.catering_amount} EGP</span>
             </div>
             <div className="flex flex-col gap-1">
                {session.orders?.map((o: any, idx: number) => (
                   <p key={idx} className="text-[9px] text-slate-400 font-extrabold flex items-center justify-end gap-1.5 min-w-max">
                      {o.time && <span className="opacity-40 font-mono text-[8px]">{new Date(o.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })}</span>}
                      {o.ordered_by && <span className="text-indigo-400">({o.ordered_by})</span>}
                      {o.name} x{o.quantity}
                   </p>
                ))}
             </div>
          </div>
        ) : (
          <span className="text-slate-200">-</span>
        )}
      </td>

      <td className="px-6 py-8 text-center text-right">
         <div className={`p-4 rounded-[2rem] inline-block min-w-[120px] ${session.payment_method === 'subscription' ? 'bg-indigo-50 border border-indigo-100' : 'bg-emerald-50 border border-emerald-100'}`}>
            <p className={`text-lg font-black ${session.payment_method === 'subscription' ? 'text-indigo-600' : 'text-emerald-600'}`}>
               {session.total_amount ? `${session.total_amount}` : '0'} <span className="text-[10px] opacity-40">EGP</span>
            </p>
            {session.payment_method === 'subscription' && <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1">Package</span>}
         </div>
      </td>

      <td className="px-10 py-8">
         <div className="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
            <button 
              onClick={() => onEdit(session)}
              className="p-3.5 bg-white text-indigo-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-100 active:scale-90"
            >
              <Receipt size={18} />
            </button>
            <button 
              onClick={() => onDelete(session.id)}
              className="p-3.5 bg-white text-rose-300 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-slate-100 active:scale-90"
            >
              <Trash2 size={18} />
            </button>
         </div>
      </td>
    </tr>
  );
};

export const DailyLog = ({ branchId }: { branchId?: string }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [dailyClosing, setDailyClosing] = useState<any>(null);
  const [dailyNote, setDailyNote] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Edit Modal States
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editCatering, setEditCatering] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [editOrders, setEditOrders] = useState<any[]>([]);
  const [editNotes, setEditNotes] = useState('');

  // Helper to format UTC ISO to Cairo Local YYYY-MM-DDTHH:mm
  const toCairoInput = (iso?: string | Date) => {
    if (!iso) return '';
    try {
      const date = typeof iso === 'string' ? new Date(iso) : iso;
      return date.toLocaleString('sv-SE', { timeZone: 'Africa/Cairo' }).replace(' ', 'T').slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  // Helper to convert local input back to UTC ISO
  const fromCairoInput = (localStr: string) => {
    if (!localStr) return null;
    return new Date(localStr).toISOString();
  };

  useEffect(() => {
    if (!branchId) return;
    
    fetchLogData();

    const channel = (supabase as any)
      .channel(`daily_log_${branchId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_sessions',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchLogData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'subscriptions',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchLogData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'expenses',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchLogData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'daily_closings',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchLogData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, selectedDate]);

  const fetchLogData = async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      
      // Calculate date range for the selected day in local time
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const startISO = startOfDay.toISOString();
      const endISO = endOfDay.toISOString();

      // 1. Fetch Sessions with Subscriptions
      const { data: sessionsData, error: errSessions } = await (supabase as any)
        .from('workspace_sessions')
        .select(`*, customers(full_name, code, subscriptions(*))`)
        .eq('branch_id', branchId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false });

      if (errSessions) throw errSessions;
      
      const sorted = (sessionsData as any[]).sort((a, b) => {
        const getPriority = (status: string) => {
          if (status === 'completed') return 0;
          if (status === 'checkout_requested') return 1;
          if (status === 'active') return 2;
          return 3;
        };
        
        const pA = getPriority(a.status);
        const pB = getPriority(b.status);
        
        if (pA !== pB) return pA - pB;
        if (a.status === 'completed') {
          return new Date(b.end_time || b.created_at).getTime() - new Date(a.end_time || a.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setSessions(sorted);

      // 2. Fetch Subscriptions for the selected day
      const { data: subsData } = await (supabase as any)
        .from('subscriptions')
        .select('price')
        .eq('branch_id', branchId)
        .gte('created_at', startISO)
        .lte('created_at', endISO);
      setSubscriptions(subsData || []);

      // 3. Fetch Expenses for the selected day
      const { data: expData } = await (supabase as any)
        .from('expenses')
        .select('*')
        .eq('branch_id', branchId)
        .eq('date', selectedDate);
      setExpenses(expData || []);

      // 4. Fetch Daily Closing Notes
      const { data: closingData } = await (supabase as any)
        .from('daily_closings')
        .select('*')
        .eq('branch_id', branchId)
        .eq('date', selectedDate)
        .maybeSingle();
      
      setDailyClosing(closingData);
      setDailyNote(closingData?.notes || '');

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (!branchId) return;
    const { data } = await (supabase as any)
      .from('inventory')
      .select('*')
      .eq('branch_id', branchId)
      .gt('stock', 0);
    setInventory(data || []);
  };

  const navigateDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('هل أنت متأكد من مسح هذه الجلسة؟ سيتم حذفها نهائياً من سجلات اليوم والتقارير المالية.')) return;
    try {
      const { error } = await (supabase as any)
        .from('workspace_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchLogData();
    } catch (err: any) {
      alert('خطأ في المسح: ' + err.message);
    }
  };

  const handleUpdateSession = async () => {
    if (!editingSession) return;
    try {
      const { error } = await (supabase as any)
        .from('workspace_sessions')
        .update({
          start_time: fromCairoInput(editStartTime),
          end_time: fromCairoInput(editEndTime),
          catering_amount: parseFloat(editCatering) || 0,
          total_amount: parseFloat(editTotal) || 0,
          orders: editOrders,
          notes: editNotes
        })
        .eq('id', editingSession.id);

      if (error) throw error;
      setEditingSession(null);
      fetchLogData();
    } catch (err: any) {
      alert('خطأ في التحديث: ' + err.message);
    }
  };

  const handleUpdateDailyNote = async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      if (dailyClosing) {
        const { error } = await (supabase as any)
          .from('daily_closings')
          .update({ notes: dailyNote })
          .eq('id', dailyClosing.id);
        if (error) throw error;
      } else {
        // Create a new closing record if none exists for the day
        const { error } = await (supabase as any)
          .from('daily_closings')
          .insert({
            branch_id: branchId,
            date: selectedDate,
            notes: dailyNote,
            expected_cash: 0,
            actual_cash: 0,
            difference: 0
          });
        if (error) throw error;
      }
      alert('تم حفظ الملاحظات بنجاح');
      fetchLogData();
    } catch (err: any) {
      alert('خطأ في حفظ الملاحظات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCheckoutRequest = async (sessionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('workspace_sessions')
        .update({ status: 'active', end_time: null })
        .eq('id', sessionId);

      if (error) throw error;
      fetchLogData();
    } catch (err: any) {
      alert('خطأ في إلغاء طلب الخروج: ' + err.message);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'active' || s.status === 'checkout_requested').length;
  const sessionsIncome = sessions.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  const subsIncome = subscriptions.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  const totalCashIn = sessionsIncome + subsIncome;
  const totalCashOut = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 font-['Cairo'] text-right pb-24 relative overflow-visible mt-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
         <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8 justify-between items-end lg:items-center">
      

        {/* Date Navigator */}
        <div className="w-full lg:w-auto bg-white/50 backdrop-blur-md p-2 rounded-[2rem] border border-white shadow-sm flex items-center justify-between lg:justify-end gap-2 md:gap-3">
          <button 
            onClick={() => navigateDate(1)}
            className="p-3 md:p-4 hover:bg-white rounded-2xl transition-all hover:shadow-sm text-slate-400 hover:text-indigo-600 active:scale-90"
          >
            <ChevronRight size={20} className="md:w-6 md:h-6" />
          </button>
          
          <div className="flex flex-col items-center px-2 md:px-4 flex-1 lg:min-w-[180px]">
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm md:text-xl font-black text-slate-800 border-none outline-none text-center cursor-pointer hover:text-indigo-600 transition-colors"
            />
            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'long' })}
            </span>
          </div>

          <button 
            onClick={() => navigateDate(-1)}
            className="p-3 md:p-4 hover:bg-white rounded-2xl transition-all hover:shadow-sm text-slate-400 hover:text-indigo-600 active:scale-90"
          >
            <ChevronLeft size={20} className="md:w-6 md:h-6" />
          </button>
        </div>

        <button 
          onClick={fetchLogData}
          className="w-full lg:w-auto bg-white text-indigo-600 px-6 py-4 md:px-8 md:py-5 rounded-[1.5rem] font-black shadow-sm border border-indigo-100 hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm md:text-base">تحديث</span>
        </button>
      </div>

      {/* Stats - Premium Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-indigo-50/50 backdrop-blur-md p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] border border-indigo-100/50 shadow-sm relative group overflow-hidden">
           <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
           <p className="text-indigo-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest text-right mb-2 lg:mb-4">زوار اليوم</p>
           <div className="flex items-center gap-2 lg:gap-3 justify-end">
              <div className="p-1.5 lg:p-2 bg-white text-indigo-600 rounded-lg lg:rounded-xl shadow-sm"><User size={16} className="lg:w-5 lg:h-5"/></div>
              <h3 className="text-2xl lg:text-4xl font-black text-indigo-900 tracking-tighter">{sessions.length}</h3>
           </div>
        </div>

        <div className="bg-slate-900 p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] text-white shadow-2xl relative group overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
           <p className="text-indigo-300 font-black text-[9px] lg:text-[10px] uppercase tracking-widest text-right mb-2 lg:mb-4">الجلسات النشطة</p>
           <div className="flex items-center gap-2 lg:gap-3 justify-end">
              <h3 className="text-2xl lg:text-4xl font-black tracking-tighter">{activeCount}</h3>
              <div className="w-2 h-2 lg:w-3 lg:h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]" />
           </div>
        </div>

        <div className="bg-emerald-600 p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] text-white shadow-xl relative group overflow-hidden">
           <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
           <div className="flex flex-row-reverse justify-between items-start">
              <div>
                 <p className="text-emerald-100 font-black text-[9px] lg:text-[10px] uppercase tracking-widest text-right mb-2 lg:mb-4">Cash In</p>
                 <h3 className="text-2xl lg:text-4xl font-black tracking-tight">{totalCashIn.toLocaleString()}</h3>
              </div>
              <ArrowUpRight className="text-emerald-100 opacity-30 lg:w-10 lg:h-10" size={24} />
           </div>
        </div>

        <div className="bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] border border-rose-100 shadow-sm relative group overflow-hidden">
           <div className="absolute top-1/2 left-0 w-32 h-32 bg-rose-50/50 rounded-full blur-3xl" />
           <div className="flex flex-row-reverse justify-between items-start">
              <div>
                 <p className="text-rose-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest text-right mb-2 lg:mb-4">Cash Out</p>
                 <h3 className="text-2xl lg:text-4xl font-black text-rose-600 tracking-tight">{totalCashOut.toLocaleString()}</h3>
              </div>
              <ArrowDownRight className="text-rose-100 lg:w-10 lg:h-10" size={24} />
           </div>
        </div>
      </div>

      {/* Daily Admin Notes Section */}
      <div className="bg-white/50 backdrop-blur-xl rounded-[2.5rem] lg:rounded-[3.5rem] border border-white shadow-sm p-6 lg:p-10">
        <div className="flex flex-row-reverse justify-between items-center mb-6">
           <div className="flex flex-row-reverse items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                 <Edit3 size={24} />
              </div>
              <div className="text-right">
                 <h3 className="text-xl font-black text-slate-800">ملاحظات اليوم الإدارية</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Signed Notes by Admin</p>
              </div>
           </div>
           <button 
             onClick={handleUpdateDailyNote}
             disabled={loading}
             className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-2"
           >
             <Save size={18} />
             <span>حفظ الملاحظة</span>
           </button>
        </div>
        <textarea 
          value={dailyNote}
          onChange={(e) => setDailyNote(e.target.value)}
          placeholder="أضف ملاحظاتك العامة لليوم هنا (المشتريات الكبرى، الأعطال، المهام المنجزة...)"
          className="w-full h-32 bg-white/80 border-2 border-slate-50 rounded-3xl p-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-right resize-none placeholder:text-slate-200 shadow-inner"
        />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] lg:rounded-[3.5rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-6 lg:p-10 border-b border-slate-100 bg-slate-50/20">
          <h3 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight text-center lg:text-right">تحليل تفاصيل الحضور</h3>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/30 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-10 py-8 text-right">المشترك & الحالة</th>
                <th className="px-6 py-8 text-center w-1/4">معدل الاستهلاك الزمني</th>
                <th className="px-6 py-8 text-center">خدمات المتجر</th>
                <th className="px-6 py-8 text-center">دخل الجلسة نهائياً</th>
                <th className="px-6 py-8 text-center">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 font-bold">
              {sessions.map(session => (
                <SessionRow 
                  key={session.id} 
                  session={session} 
                  onEdit={(s) => {
                    setEditingSession(s);
                    setEditStartTime(toCairoInput(s.start_time));
                    setEditEndTime(toCairoInput(s.end_time));
                    setEditCatering(s.catering_amount.toString());
                    setEditTotal(s.total_amount?.toString() || '0');
                    setEditOrders(s.orders || []);
                    setEditNotes(s.notes || '');
                  }}
                  onDelete={handleDeleteSession}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden p-4 space-y-4">
          {sessions.map((session) => {
             const activeSub = session.customers?.subscriptions?.find((s: any) => 
               s.status === 'Active' && 
               new Date(s.end_date) >= new Date() &&
               s.used_hours < s.total_hours
             );

             return (
               <div key={session.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
                          <User size={18} />
                       </div>
                       <div className="text-right">
                          <p className="font-black text-slate-800 text-sm">
                             {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم')}
                          </p>
                          <p className="text-[10px] font-black text-slate-400 mt-0.5">{session.user_code}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => {
                            setEditingSession(session);
                            setEditStartTime(toCairoInput(session.start_time));
                            setEditEndTime(toCairoInput(session.end_time));
                            setEditCatering(session.catering_amount.toString());
                            setEditTotal(session.total_amount?.toString() || '0');
                            setEditOrders(session.orders || []);
                            setEditNotes(session.notes || '');
                         }}
                         className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl active:scale-90"
                       >
                         <Receipt size={16} />
                       </button>
                       <button 
                         onClick={() => handleDeleteSession(session.id)}
                         className="p-2.5 bg-rose-50 text-rose-500 rounded-xl active:scale-90"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>

                  {activeSub && (
                    <div className="mb-4 bg-emerald-50 rounded-2xl p-3 border border-emerald-100/50 flex justify-between items-center">
                       <div className="flex items-center gap-1.5 text-emerald-600">
                          <Sparkles size={12} className="animate-pulse" />
                          <span className="text-[9px] font-black uppercase">Subscribed</span>
                       </div>
                       <p className="text-[9px] font-black text-emerald-700">Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">الدخـول</p>
                       <p className="text-xs font-black text-slate-700 text-right dir-ltr">
                         {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })}
                       </p>
                    </div>
                    <div className={`rounded-2xl p-3 border ${session.end_time ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100/50'}`}>
                       <p className={`text-[8px] font-black uppercase tracking-widest mb-1 text-right ${session.end_time ? 'text-slate-400' : 'text-emerald-600'}`}>{session.end_time ? 'الخروج' : 'الحالة'}</p>
                       <p className={`text-xs font-black text-right dir-ltr ${session.end_time ? 'text-slate-700' : 'text-emerald-700'}`}>
                         {session.end_time ? new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : 'نشط الآن'}
                       </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="text-right">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">المشتريات السريعة (Cafeteria)</p>
                       <div className="flex flex-col gap-0.5 mb-1">
                          {session.orders?.map((o: any, idx: number) => (
                             <p key={idx} className="text-[10px] font-bold text-slate-600 flex items-center justify-end gap-1.5">
                                {o.time && <span className="opacity-40 text-[9px]">{new Date(o.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })}</span>}
                                {o.ordered_by && <span className="text-indigo-500/60 lowercase tracking-tighter">@{o.ordered_by}</span>}
                                <span>{o.name}</span>
                             </p>
                          ))}
                       </div>
                       <p className="text-sm font-black text-slate-900 border-t border-slate-50 pt-1 mt-1">{session.catering_amount} <span className="text-[9px] opacity-40">EGP</span></p>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl text-right ${session.payment_method === 'subscription' ? 'bg-indigo-50 border border-indigo-100' : 'bg-emerald-50 border border-emerald-100/50'}`}>
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">الإجمالي</p>
                       <p className={`text-base font-black ${session.payment_method === 'subscription' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                         {session.total_amount || 0} <span className="text-[9px] opacity-40">EGP</span>
                       </p>
                    </div>
                  </div>
               </div>
             );
          })}
          {sessions.length === 0 && (
            <div className="py-20 text-center glass rounded-3xl border-2 border-dashed border-slate-100">
              <User size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="font-black text-slate-400">لا يوجد بيانات لعرضها</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Session Modal - High End Portal */}
      <Modal
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        title={editingSession ? `تعديل سجل الجلسة - ${editingSession.user_code}` : ""}
        className="max-w-xl p-0 overflow-hidden"
      >
          <div className="bg-white text-right font-['Cairo']">
             <div className="p-10 space-y-10">
                {/* Subscription Info Card if applicable */}
                {editingSession && editingSession.payment_method === 'subscription' && (
                  <div className="bg-indigo-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent -z-10" />
                    <div className="flex flex-row-reverse justify-between items-center relative z-10 text-right">
                       <div>
                          <p className="text-4xl font-black">
                            {(Number((editingSession.customers?.subscriptions?.[0]?.total_hours || 0) - (editingSession.customers?.subscriptions?.[0]?.used_hours || 0))).toFixed(1)} 
                            <span className="text-sm opacity-50 uppercase tracking-widest mr-2">H Left</span>
                          </p>
                          <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {editingSession.customers?.subscriptions?.[0] ? new Date(editingSession.customers.subscriptions[0].end_date).toLocaleDateString('ar-EG') : 'N/A'}
                          </p>
                       </div>
                       <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                             <h4 className="text-xl font-black">جلسة مشتركة</h4>
                             <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                          </div>
                          <p className="text-xs font-bold text-indigo-200">الدفع عبر رصيد الساعات المفعل</p>
                          <p className="text-[10px] text-white/40 font-black mt-2 uppercase tracking-widest">
                            {(Number(editingSession.total_minutes || 0) / 60).toFixed(2)}h deducted in this session
                          </p>
                       </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">وقت البدء</label>
                      <input 
                        type="datetime-local" 
                        value={editStartTime} 
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                      />
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center px-2">
                        <div className="flex gap-1">
                          <button 
                            onClick={() => {
                              const d = new Date(editEndTime || editStartTime);
                              d.setMinutes(d.getMinutes() + 30);
                              setEditEndTime(toCairoInput(d.toISOString()));
                            }}
                            className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black hover:bg-indigo-100"
                          >+30m</button>
                          <button 
                            onClick={() => {
                              const d = new Date(editEndTime || editStartTime);
                              d.setMinutes(d.getMinutes() - 30);
                              setEditEndTime(toCairoInput(d.toISOString()));
                            }}
                            className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black hover:bg-rose-100"
                          >-30m</button>
                          <button 
                            onClick={() => setEditEndTime(toCairoInput(new Date().toISOString()))}
                            className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black hover:bg-emerald-100"
                          >Now</button>
                        </div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">وقت المغادرة</label>
                      </div>
                      <input 
                        type="datetime-local" 
                        value={editEndTime} 
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">ملاحظات المسؤول (Admin Notes)</label>
                   <textarea 
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="أضف ملاحظاتك حول السيشن هنا..."
                      className="w-full h-24 bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-right resize-none placeholder:text-slate-200 shadow-inner"
                   />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">تكلفة المتجر</label>
                      <input 
                        type="number" 
                        value={editCatering} 
                        readOnly
                        className="w-full h-16 bg-slate-100 border-2 border-slate-200 rounded-3xl px-6 text-sm font-black text-slate-400 outline-none transition-all text-center cursor-not-allowed"
                      />
                      <p className="text-[10px] text-center text-slate-400 font-bold">يُحسب تلقائياً من المنتجات</p>
                   </div>
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">الإجمالي النهائي</label>
                      <input 
                        type="number" 
                        value={editTotal} 
                        onChange={(e) => setEditTotal(e.target.value)}
                        className="w-full h-16 bg-emerald-50 border-2 border-emerald-100 rounded-3xl px-6 text-sm font-black text-emerald-600 outline-none focus:border-emerald-500 transition-all text-center"
                      />
                   </div>
                </div>

                {/* Orders Management */}
                <div className="space-y-6 pt-6 border-t border-slate-50">
                    <div className="flex justify-between items-center px-2">
                        <select 
                            className="text-xs font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl border-none outline-none cursor-pointer"
                            onChange={(e) => {
                                const prod = inventory.find(i => i.id === e.target.value);
                                if (prod) {
                                    const newOrders = [...editOrders, { 
                                        id: prod.id, 
                                        name: prod.name, 
                                        price: prod.retail_price, 
                                        quantity: 1,
                                        category: prod.category 
                                    }];
                                    setEditOrders(newOrders);
                                    const newCatering = newOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
                                    const diff = parseFloat(editTotal) - parseFloat(editCatering);
                                    setEditCatering(newCatering.toString());
                                    setEditTotal((diff + newCatering).toString());
                                }
                            }}
                            value=""
                        >
                            <option value="" disabled>+ إضافة منتج من المخزن</option>
                            {inventory.map(item => (
                                <option key={item.id} value={item.id}>{item.name} - {item.retail_price} EGP</option>
                            ))}
                        </select>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">منتجات المتجر (Catering)</label>
                    </div>

                    <div className="space-y-3">
                        {editOrders.map((order, idx) => (
                            <div key={idx} className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                <button 
                                    onClick={() => {
                                        const newOrders = editOrders.filter((_, i) => i !== idx);
                                        setEditOrders(newOrders);
                                        const newCatering = newOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
                                        const diff = parseFloat(editTotal) - parseFloat(editCatering);
                                        setEditCatering(newCatering.toString());
                                        setEditTotal((diff + newCatering).toString());
                                    }}
                                    className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="flex-1 text-right">
                                    <p className="text-sm font-black text-slate-700">{order.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{order.price} EGP / Unit</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100">
                                    <input 
                                        type="number" 
                                        value={order.quantity}
                                        onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 0;
                                            const newOrders = [...editOrders];
                                            newOrders[idx] = { ...newOrders[idx], quantity: newQty };
                                            setEditOrders(newOrders);
                                            const newCatering = newOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
                                            const diff = parseFloat(editTotal) - parseFloat(editCatering);
                                            setEditCatering(newCatering.toString());
                                            setEditTotal((diff + newCatering).toString());
                                        }}
                                        className="w-12 text-center text-sm font-black text-indigo-600 bg-transparent border-none outline-none"
                                    />
                                    <Tag size={12} className="text-slate-300" />
                                </div>
                            </div>
                        ))}
                        {editOrders.length === 0 && (
                            <div className="py-10 text-center text-slate-300 font-bold border-2 border-dashed border-slate-100 rounded-3xl">لا توجد منتجات مسجلة</div>
                        )}
                    </div>
                </div>

                <button 
                   onClick={handleUpdateSession}
                   className="w-full h-24 bg-slate-900 text-white rounded-[2rem] font-black text-2xl hover:bg-indigo-600 transition-all shadow-3xl flex items-center justify-center gap-5 group active:scale-95 mt-4"
                >
                   <Save size={32} />
                   <span>تأكيد وحفظ التغييرات</span>
                   <ChevronLeft size={32} className="group-hover:-translate-x-2 transition-transform" />
                </button>
             </div>
          </div>
      </Modal>
    </div>
  );
};

export default DailyLog;
