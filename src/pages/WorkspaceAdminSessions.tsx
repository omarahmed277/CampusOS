import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, RefreshCw, X, Receipt, Users2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateSessionPrice } from '../lib/pricing';
import { Modal } from '../components/ui';

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
  customers?: { full_name: string };
}

export const WorkspaceAdminSessions = ({ branchId }: { branchId?: string }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [checkoutBill, setCheckoutBill] = useState<any>(null);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [manualCode, setManualCode] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  // Helper to format UTC ISO to Cairo Local YYYY-MM-DDTHH:mm
  const toCairoInput = (iso?: string | Date) => {
    if (!iso) return '';
    try {
      const date = typeof iso === 'string' ? new Date(iso) : iso;
      // 'sv-SE' gives YYYY-MM-DD HH:mm:ss format
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
    
    fetchSessions();
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // UI update every minute

    const channel = supabase
      .channel(`workspace_admin_sessions_${branchId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'workspace_sessions'
          // Removed specific filter to handle JS-side filtering for robustness
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Only refresh if the change belongs to our branch or was moved out of it
          if (newData?.branch_id === branchId || oldData?.branch_id === branchId) {
            fetchSessions();
          }
        }
      )
      .on('broadcast', { event: 'session_updated' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('workspace_sessions')
        .select(`*, customers(full_name, subscriptions(*))`)
        .eq('branch_id', branchId || '')
        .in('status', ['active', 'checkout_requested'])
        .order('start_time', { ascending: false });

      if (error) throw error;
      
      const sorted = (data as any[]).sort((a, b) => {
        if (a.status === 'checkout_requested' && b.status !== 'checkout_requested') return -1;
        if (a.status !== 'checkout_requested' && b.status === 'checkout_requested') return 1;
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      });
      
      setSessions(sorted);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareCheckout = (session: Session | any) => {
    const endTime = (session.status === 'checkout_requested' && session.end_time) 
      ? new Date(session.end_time) 
      : new Date();
    const startTime = new Date(session.start_time);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000));
    const usedHours = parseFloat((diffMinutes / 60).toFixed(2));

    // Check for Active Subscription
    const activeSub = session.customers?.subscriptions?.find((s: any) => 
        s.status === 'Active' && 
        new Date(s.end_date) >= new Date() &&
        s.used_hours < s.total_hours
    );

    let workspaceAmount = calculateSessionPrice(diffMinutes);
    let isSubscribed = false;
    let remainingSubHours = 0;

    if (activeSub) {
        isSubscribed = true;
        workspaceAmount = 0; 
        remainingSubHours = activeSub.total_hours - activeSub.used_hours;
    }
    
    const orders = Array.isArray(session.orders) ? [...session.orders] : [];
    const cateringAmount = orders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
    const totalAmount = workspaceAmount + cateringAmount;

    setEditingBill({
      ...session,
      orders,
      workspaceAmount,
      cateringAmount,
      totalAmount,
      diffMinutes,
      usedHours,
      startTime: session.start_time,
      endTime: endTime.toISOString(),
      isSubscribed,
      subscriptionId: activeSub?.id,
      remainingSubHours: remainingSubHours - usedHours,
      initialRemaining: remainingSubHours,
      subEndDate: activeSub?.end_date
    });
  };

  const handleUpdateTime = (field: 'startTime' | 'endTime', value: string) => {
    if (!editingBill) return;
    
    // Convert local input strings directly to ISO
    const startTime = field === 'startTime' ? fromCairoInput(value) : editingBill.startTime;
    const endTime = field === 'endTime' ? fromCairoInput(value) : editingBill.endTime;
    
    if (!startTime || !endTime) return;

    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000));
    const usedHours = parseFloat((diffMinutes / 60).toFixed(2));

    let workspaceAmount = 0;
    let remainingSubHours = 0;

    if (editingBill.isSubscribed) {
       workspaceAmount = 0;
       remainingSubHours = editingBill.initialRemaining - usedHours;
    } else {
       workspaceAmount = calculateSessionPrice(diffMinutes);
    }

    const totalAmount = workspaceAmount + editingBill.cateringAmount;

    setEditingBill({
       ...editingBill,
       startTime,
       endTime,
       diffMinutes,
       usedHours,
       workspaceAmount,
       totalAmount,
       remainingSubHours
    });
  };

  const handleUpdateBillItem = (index: number, field: string, value: any) => {
    if (!editingBill) return;
    const newOrders = [...editingBill.orders];
    newOrders[index] = { ...newOrders[index], [field]: value };
    
    const newCateringAmount = newOrders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
    const newTotalAmount = parseFloat((Number(editingBill.workspaceAmount) + newCateringAmount).toFixed(2));
    
    setEditingBill({
      ...editingBill,
      orders: newOrders,
      cateringAmount: newCateringAmount,
      totalAmount: newTotalAmount
    });
  };

  const handleRemoveBillItem = (index: number) => {
    if (!editingBill) return;
    const newOrders = editingBill.orders.filter((_: any, i: number) => i !== index);
    const newCateringAmount = newOrders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
    const newTotalAmount = parseFloat((Number(editingBill.workspaceAmount) + newCateringAmount).toFixed(2));
    
    setEditingBill({
      ...editingBill,
      orders: newOrders,
      cateringAmount: newCateringAmount,
      totalAmount: newTotalAmount
    });
  };

  const handleAddBillItem = () => {
    if (!editingBill) return;
    const newOrders = [...editingBill.orders, { name: 'صنف جديد', price: 0, quantity: 1, time: new Date().toISOString() }];
    setEditingBill({ ...editingBill, orders: newOrders });
  };

  const handleAcceptCheckout = async () => {
    if (!editingBill) return;
    try {
      // 1. Update the session record
      const { error: sessionError } = await supabase
        .from('workspace_sessions')
        .update({
          status: 'completed',
          start_time: editingBill.startTime,
          end_time: editingBill.endTime,
          total_minutes: Number(editingBill.diffMinutes) || 0,
          catering_amount: Number(editingBill.cateringAmount) || 0,
          orders: editingBill.orders || [],
          total_amount: Number(editingBill.totalAmount) || 0,
          payment_method: editingBill.isSubscribed ? 'subscription' : 'cash'
        })
        .eq('id', editingBill.id);

      if (sessionError) {
          console.error('Session Update Error:', sessionError);
          throw sessionError;
      }

      // 2. Adjust Subscription Balance if applicable
      if (editingBill.isSubscribed && editingBill.subscriptionId) {
          const { data: sub, error: subFetchError } = await supabase
              .from('subscriptions')
              .select('used_hours, total_hours')
              .eq('id', editingBill.subscriptionId)
              .single();
          
          if (subFetchError) {
              console.error('Subscription Fetch Error:', subFetchError);
          } else if (sub) {
              const newUsed = parseFloat((Number(sub.used_hours || 0) + (Number(editingBill.usedHours) || 0)).toFixed(2));
              const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({ 
                    used_hours: newUsed,
                    status: newUsed >= Number(sub.total_hours) ? 'Exhausted' : 'Active'
                })
                .eq('id', editingBill.subscriptionId);
              
              if (subUpdateError) console.error('Subscription Update Error:', subUpdateError);
          }
      }

      setCheckoutBill({ ...editingBill, remainingAfter: editingBill.remainingSubHours });
      setEditingBill(null);
      fetchSessions();
    } catch (err: any) {
      alert('حدث خطأ أثناء إنهاء الجلسة. يرجى مراجعة سجلات الكونسول.');
      console.error('Checkout Main Error:', err);
    }
  };

  const handleCancelCheckoutRequest = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ status: 'active', end_time: null })
        .eq('id', sessionId);

      if (error) throw error;
      fetchSessions();

      // Broadcast to user to resume counter
      supabase.channel(`workspace_session_${sessionId}`).send({
        type: 'broadcast',
        event: 'session_updated',
        payload: { id: sessionId, status: 'active', end_time: null }
      });
    } catch (err: any) {
      alert('حدث خطأ أثناء إلغاء طلب الخروج');
      console.error(err);
    }
  };

  const handleStartManualSession = async () => {
    if (!manualCode.trim()) return;
    setStartingSession(true);
    try {
      // 1. Check if an active session already exists for this code
      const { data: existing } = await supabase
        .from('workspace_sessions')
        .select('id')
        .eq('user_code', manualCode.trim().toUpperCase())
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      if (existing) {
        alert('هذا الكود لديه جلسة نشطة بالفعل');
        return;
      }

      // 2. Fetch customer if exists
      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .eq('code', manualCode.trim().toUpperCase())
        .maybeSingle();

      // 3. Create session
      const { error } = await supabase
        .from('workspace_sessions')
        .insert({
          customer_id: customer?.id || null,
          user_code: manualCode.trim().toUpperCase(),
          phone_number: customer?.phone || 'غير مسجل',
          status: 'active',
          branch_id: branchId,
          start_time: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      setManualCode('');
      fetchSessions();
      alert(customer ? `تم بدء جلسة لـ ${customer.full_name}` : `تم بدء جلسة زائر بكود ${manualCode.toUpperCase()}`);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء بدء الجلسة');
    } finally {
      setStartingSession(false);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'active').length;
  const requestedCount = sessions.filter(s => s.status === 'checkout_requested').length;

  return (
    <div className="space-y-12 animate-in fade-in duration-700 mt-6 pb-20">

      {/* Manual Entry Section */}
      <div className="glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -z-10" />
        <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8">
          <div className="flex-1 text-center lg:text-right space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-800">بدء جلسة يدوياً</h2>
            <p className="text-slate-400 font-bold text-xs md:text-sm">أدخل كود المستخدم (مثال: A001) أو كود الزائر (مثال: NA1)</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full lg:w-auto items-center gap-4">
            <div className="relative w-full sm:w-64 group/input">
              <input 
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="A001 , NA1 ..."
                className="w-full h-14 md:h-16 px-6 rounded-2xl bg-white border-2 border-slate-100 font-black text-lg md:text-xl text-center focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all outline-none uppercase placeholder:text-slate-200"
                onKeyDown={(e) => e.key === 'Enter' && handleStartManualSession()}
              />
            </div>
            <button 
              onClick={handleStartManualSession}
              disabled={startingSession || !manualCode.trim()}
              className="w-full sm:w-auto h-14 md:h-16 px-8 bg-indigo-600 text-white rounded-2xl font-black text-sm md:text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap"
            >
              {startingSession ? <RefreshCw className="animate-spin" size={20} /> : <Clock size={20} />}
              <span>بدء الجلسة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="glass rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px]" />
          <div className="flex items-center gap-4 md:gap-6 relative z-10">
            <div className="bg-indigo-500/20 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
              <Clock size={24} className="text-indigo-500 md:hidden" />
              <Clock size={32} className="text-indigo-500 hidden md:block" />
            </div>
            <div>
              <p className="text-slate-400 font-black text-[10px] md:text-sm mb-0.5 uppercase tracking-widest">جلسات نشطة</p>
              <h3 className="text-2xl md:text-4xl font-black text-slate-900">{activeCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px]" />
          <div className="flex items-center gap-4 md:gap-6 relative z-10">
            <div className="bg-amber-500/20 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
              <AlertCircle size={24} className="text-amber-500 md:hidden" />
              <AlertCircle size={32} className="text-amber-500 hidden md:block" />
            </div>
            <div>
              <p className="text-slate-400 font-black text-[10px] md:text-sm mb-0.5 uppercase tracking-widest">طلبات خروج</p>
              <h3 className="text-2xl md:text-4xl font-black text-amber-600">{requestedCount}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="text-center sm:text-right">
            <h2 className="text-xl md:text-2xl font-black text-slate-900">إدارة الجلسات الحالية</h2>
            <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Live Workspace Monitor</p>
          </div>
          <button 
            onClick={fetchSessions}
            className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="text-xs font-black sm:hidden tracking-wider">تحديث البيانات</span>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
            <table className="w-full text-right min-w-[800px]">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/30">
                  <th className="py-6 px-6 text-indigo-900 font-black">المستخدم</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">رقم الهاتف</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">وقت البدء</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">الوقت المنقضي</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">طلبات الكافتريا</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">الحالة</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">تحديث</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const diffMs = now - new Date(session.start_time).getTime();
                  const totalMins = Math.floor(diffMs / 60000);
                  const hrs = Math.floor(totalMins / 60);
                  const mins = totalMins % 60;
                  
                  const activeSub = session.customers?.subscriptions?.find((s: any) => 
                    s.status === 'Active' && 
                    new Date(s.end_date) >= new Date() &&
                    s.used_hours < s.total_hours
                  );

                  return (
                    <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group">
                      <td className="py-6 px-6">
                        <div className="flex flex-row-reverse items-center justify-end gap-3 text-right">
                          <div className="text-right">
                            <div className="font-extrabold text-slate-900 text-lg">
                              {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم غير مسجل')}
                            </div>
                            <div className="flex flex-row-reverse items-center gap-2 mt-1">
                               <div className="text-sm font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg w-fit">{session.user_code}</div>
                               {activeSub && (
                                  <div className="flex flex-row-reverse items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black animate-pulse">
                                     <Sparkles size={10} />
                                     <span>Subscribed</span>
                                  </div>
                               )}
                            </div>
                            {activeSub && (
                               <div className="mt-2 space-y-1 text-right border-r-2 border-emerald-100 pr-2 mr-1">
                                  <p className="text-[9px] font-black text-slate-400">Ends: {new Date(activeSub.end_date).toLocaleDateString('ar-EG')}</p>
                                  <p className="text-[10px] font-black text-emerald-600">Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H</p>
                                </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-6 font-bold text-slate-600">{session.phone_number}</td>
                      <td className="py-6 px-6 font-semibold text-slate-600">
                        {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-6 px-6">
                        <div className="font-mono text-lg font-black text-indigo-600 flex items-center gap-2">
                          <Clock size={16} />
                          {hrs}س {mins}د
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="font-black text-slate-900 text-lg">
                          {session.catering_amount || 0} EGP
                        </div>
                        <div className="text-xs text-slate-400 max-w-[150px] truncate mt-1">
                          {session.orders?.length > 0 ? session.orders.map((o: any) => `${o.quantity}x ${o.name}`).join('، ') : 'بدون طلبات'}
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        {session.status === 'checkout_requested' ? (
                          <div className="bg-amber-100/50 border border-amber-200 text-amber-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max animate-pulse">
                            <AlertCircle size={14} /> يطلب الخروج
                          </div>
                        ) : (
                          <div className="bg-emerald-100/50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max">
                            <CheckCircle2 size={14} /> نشط الآن
                          </div>
                        )}
                      </td>
                      <td className="py-6 px-6">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handlePrepareCheckout(session)}
                            className={`px-6 py-3 rounded-2xl text-white font-black text-sm transition-all hover:-translate-y-1 active:scale-95 shadow-lg ${
                              session.status === 'checkout_requested' 
                                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                                : 'bg-slate-900 hover:bg-black shadow-slate-900/20'
                            }`}
                          >
                            إنهاء و محاسبة
                          </button>
                          {session.status === 'checkout_requested' && (
                            <button
                              onClick={() => handleCancelCheckoutRequest(session.id)}
                              className="px-4 py-1.5 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center gap-1"
                            >
                              <X size={12} /> إلغاء طلب الخروج
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sessions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-300">
                        <Users2 size={64} className="opacity-20" />
                        <p className="font-black text-xl">لا يوجد جلسات نشطة حالياً</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {sessions.map((session) => {
              const diffMs = now - new Date(session.start_time).getTime();
              const totalMins = Math.floor(diffMs / 60000);
              const hrs = Math.floor(totalMins / 60);
              const mins = totalMins % 60;
              
              const activeSub = session.customers?.subscriptions?.find((s: any) => 
                s.status === 'Active' && 
                new Date(s.end_date) >= new Date() &&
                s.used_hours < s.total_hours
              );

              return (
                <div key={session.id} className={`p-5 rounded-3xl border-2 transition-all duration-300 ${session.status === 'checkout_requested' ? 'bg-amber-50/30 border-amber-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${session.status === 'checkout_requested' ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-indigo-600 shadow-lg shadow-indigo-600/20'}`}>
                        {session.status === 'checkout_requested' ? <AlertCircle size={24} /> : <Users2 size={24} />}
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900 text-base leading-tight">
                          {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم مجهول')}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 mt-0.5">{session.user_code} • {session.phone_number}</div>
                      </div>
                    </div>
                    {session.status === 'checkout_requested' && (
                       <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">وقت البدء</p>
                       <p className="font-black text-slate-900 text-sm dir-ltr text-right">
                         {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                       </p>
                    </div>
                    <div className="bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/30">
                       <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 text-right">مدة الجلسة</p>
                       <div className="font-black text-indigo-600 text-sm flex items-center justify-end gap-1.5">
                          <span>{hrs}س {mins}د</span>
                          <Clock size={12} />
                       </div>
                    </div>
                  </div>

                  {activeSub && (
                    <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 mb-4 flex justify-between items-center">
                       <div className="flex items-center gap-1.5 text-emerald-600">
                          <Sparkles size={14} className="animate-pulse" />
                          <span className="text-[10px] font-black uppercase">Subscribed</span>
                       </div>
                       <p className="text-[10px] font-black text-emerald-700">Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">الكافتيريا</p>
                      <p className="font-black text-slate-900 text-lg">{session.catering_amount || 0} <span className="text-[10px] opacity-40">EGP</span></p>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <button
                        onClick={() => handlePrepareCheckout(session)}
                        className={`w-full py-3 px-4 rounded-2xl text-white font-black text-sm transition-all shadow-lg active:scale-95 ${
                          session.status === 'checkout_requested' 
                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                            : 'bg-slate-900 hover:bg-black shadow-slate-900/20'
                        }`}
                      >
                        إنهاء و محاسبة
                      </button>
                      {session.status === 'checkout_requested' && (
                        <button
                          onClick={() => handleCancelCheckoutRequest(session.id)}
                          className="w-full py-2 text-rose-500 bg-rose-50 rounded-xl text-[10px] font-black transition-colors"
                        >
                          إلغاء طلب الخروج
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sessions.length === 0 && !loading && (
              <div className="py-20 text-center glass rounded-[2rem] border-2 border-dashed border-slate-100">
                <Users2 size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="font-black text-slate-400">لا يوجد جلسات نشطة</p>
              </div>
            )}
          </div>
      </div>
      
      {/* Bill Adjustment Modal */}
      <Modal 
        isOpen={!!editingBill} 
        onClose={() => setEditingBill(null)} 
        title="مراجعة وتعديل الحساب"
        className="max-w-2xl"
      >
        {editingBill && (
            <div className="space-y-6 flex-1">
              {/* Subscription Info Badge */}
              {editingBill.isSubscribed && (
                <div className="bg-indigo-900 text-white p-6 rounded-3xl relative overflow-hidden group shadow-xl">
                   <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent -z-10" />
                   <div className="flex justify-between items-center relative z-10 text-right">
                      <div>
                         <p className="text-4xl font-black">{editingBill.remainingSubHours.toFixed(1)} <span className="text-sm opacity-50 uppercase tracking-widest">H Left</span></p>
                         <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">Expires: {new Date(editingBill.subEndDate).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <div className="text-right">
                         <div className="flex items-center gap-2 justify-end mb-1">
                            <h4 className="text-lg font-black">اشتراك فعال للساعات</h4>
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                         </div>
                         <p className="text-xs font-bold text-indigo-200">سيتم الخصم المباشر من رصيد العميل</p>
                      </div>
                   </div>
                </div>
              )}

              {/* Time Control */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 relative group/start">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">وقت الدخول</label>
                    <div className="relative">
                      <input 
                        type="datetime-local" 
                        value={toCairoInput(editingBill.startTime)} 
                        onChange={(e) => handleUpdateTime('startTime', e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs md:text-sm font-black outline-none focus:border-indigo-400 transition-all text-right [color-scheme:light]"
                      />
                    </div>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 relative group/end">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">وقت الخروج</label>
                    <div className="relative">
                      <input 
                        type="datetime-local" 
                        value={toCairoInput(editingBill.endTime)} 
                        onChange={(e) => handleUpdateTime('endTime', e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs md:text-sm font-black outline-none focus:border-indigo-400 transition-all text-right [color-scheme:light]"
                      />
                    </div>
                 </div>
              </div>

              {/* User Info */}
              <div className="bg-slate-50 p-5 md:p-6 rounded-[2.5rem] grid grid-cols-2 md:grid-cols-3 gap-6 border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                <div className="text-right col-span-2 md:col-span-1">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest">العميل</p>
                  <p className="font-black text-slate-900 text-lg md:text-xl truncate">{editingBill.customers?.full_name || editingBill.user_code}</p>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest">وقت الجلسة</p>
                    <div className="flex items-center justify-end gap-1.5 font-black text-indigo-600">
                       <span className="text-base md:text-lg">{Math.floor(editingBill.diffMinutes / 60)}h {editingBill.diffMinutes % 60}m</span>
                       <Clock size={14} />
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest text-[#f78c2a]">مبلـغ المكان</p>
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="number" 
                        value={editingBill.workspaceAmount} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingBill({...editingBill, workspaceAmount: val, totalAmount: parseFloat((val + editingBill.cateringAmount).toFixed(2))});
                        }}
                        className={`w-24 h-10 text-center font-black bg-white border-2 border-slate-200 rounded-xl focus:border-[#f78c2a] focus:ring-4 focus:ring-[#f78c2a]/10 outline-none text-sm transition-all ${editingBill.isSubscribed ? 'opacity-30' : ''}`} 
                        disabled={editingBill.isSubscribed}
                      />
                    </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-black text-slate-700 text-sm">طلبات الكافتريا</h3>
                  <button onClick={handleAddBillItem} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-colors">إضافة صنف +</button>
                </div>
                
                <div className="space-y-3">
                  {editingBill.orders.map((o: any, idx: number) => (
                    <div key={idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-center bg-white p-4 border border-slate-100 rounded-[2rem] group hover:border-indigo-200 transition-all shadow-sm">
                       <div className="w-full sm:col-span-5 text-right font-black text-slate-800">
                         <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">اسم الصنف</p>
                         <input 
                           className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 outline-none text-sm" 
                           value={o.name} 
                           onChange={(e) => handleUpdateBillItem(idx, 'name', e.target.value)}
                         />
                       </div>
                       <div className="w-full sm:col-span-3 text-right">
                         <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">السعـر</p>
                         <input 
                           type="number" 
                           className="w-full text-center font-black text-emerald-600 bg-emerald-50/50 border-none rounded-xl px-3 py-2 outline-none text-sm" 
                           value={o.price} 
                           onChange={(e) => handleUpdateBillItem(idx, 'price', e.target.value)}
                         />
                       </div>
                       <div className="w-full sm:col-span-3 text-right">
                         <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">الكمية</p>
                         <input 
                           type="number" 
                           className="w-full text-center font-black text-indigo-600 bg-indigo-50/50 border-none rounded-xl px-3 py-2 outline-none text-sm" 
                           value={o.quantity || 1} 
                           onChange={(e) => handleUpdateBillItem(idx, 'quantity', e.target.value)}
                         />
                       </div>
                       <div className="w-full sm:col-span-1 flex justify-center sm:justify-end">
                         <button onClick={() => handleRemoveBillItem(idx)} className="text-rose-400 hover:text-rose-600 p-2 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 rounded-lg">
                            <X size={20} />
                         </button>
                       </div>
                    </div>
                  ))}
                  {editingBill.orders.length === 0 && (
                    <p className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">لا توجد طلبات مسجلة</p>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                 <div className="flex flex-col sm:flex-row justify-between items-center gap-8 text-center sm:text-right">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">الإجمالي المستحق</p>
                      <div className="flex items-center justify-center sm:justify-end gap-2">
                        <span className="text-5xl font-black text-emerald-600">{editingBill.totalAmount}</span>
                        <span className="text-sm font-black text-slate-300">EGP</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <button onClick={() => setEditingBill(null)} className="w-full sm:w-auto px-8 py-5 rounded-[1.5rem] bg-slate-50 text-slate-500 font-black text-sm hover:bg-slate-100 transition-all active:scale-95">تراجـع</button>
                      <button onClick={handleAcceptCheckout} className="w-full sm:w-auto px-12 py-5 rounded-[1.5rem] bg-emerald-600 text-white font-black text-sm shadow-2xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95">تأكيد ومحاسبة</button>
                    </div>
                 </div>
              </div>
            </div>
        )}
      </Modal>

      {/* Checkout Success Bill Modal */}
      <Modal 
        isOpen={!!checkoutBill} 
        onClose={() => setCheckoutBill(null)} 
        title="فاتورة العميل"
        className="max-w-md"
      >
        {checkoutBill && (
            <div className="space-y-6 md:space-y-8">
              <div className="bg-slate-50/80 rounded-[2.5rem] p-6 md:p-8 space-y-6 relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                
                <div className="border-b-2 border-dashed border-slate-200 pb-6 text-center">
                  <p className="text-slate-400 text-[10px] md:text-xs font-black mb-2 uppercase tracking-widest">Client Name</p>
                  <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                    {checkoutBill.customers?.full_name || (checkoutBill.user_code.startsWith('NA') ? `Guest (${checkoutBill.user_code})` : 'Unknown')}
                  </p>
                  <div className="mt-3">
                    <p className="text-sm md:text-lg font-black text-indigo-600 bg-white inline-block px-4 py-1.5 rounded-xl shadow-sm border border-indigo-50 font-mono tracking-wider">{checkoutBill.user_code}</p>
                  </div>
                </div>
                
                <div className="space-y-3 font-black text-slate-600">
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">وقت الاستخدام</span>
                    <span className="text-slate-900 text-sm md:text-base">
                       {Math.floor(checkoutBill.diffMinutes / 60)}h {checkoutBill.diffMinutes % 60}m
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">تكلفة الاستخدام</span>
                    <span className={`text-sm md:text-base ${checkoutBill.isSubscribed ? 'text-indigo-600' : 'text-slate-900'}`}>
                       {checkoutBill.isSubscribed ? '✓ اشتراك ساعات' : `${checkoutBill.workspaceAmount} EGP`}
                    </span>
                  </div>

                  {checkoutBill.isSubscribed && (
                    <div className="bg-indigo-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-500">
                      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-400/20 to-transparent -z-10" />
                      <div className="flex justify-between items-center relative z-10">
                        <div className="text-left">
                          <p className="text-xl md:text-2xl font-black">
                            {checkoutBill.remainingSubHours.toFixed(1)} 
                            <span className="text-[8px] md:text-[10px] opacity-40 uppercase ml-1">H Left</span>
                          </p>
                          <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {new Date(checkoutBill.subEndDate).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Subscription</p>
                          <p className="text-[11px] md:text-sm font-black text-indigo-100">{(Number(checkoutBill.usedHours) || 0).toFixed(2)}h used</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">طلبات الكافتيريا</span>
                    <span className="text-slate-900 text-sm md:text-base">{checkoutBill.cateringAmount} EGP</span>
                  </div>
                </div>
                
                {checkoutBill.orders && checkoutBill.orders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em] text-center">أصناف الضيافة</p>
                    <div className="space-y-2">
                      {checkoutBill.orders.map((o: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] md:text-sm font-black bg-white rounded-xl p-3 border border-slate-50 shadow-sm">
                          <span className="text-slate-500">{o.name} <span className="text-[9px] opacity-50 px-2 py-0.5 bg-slate-50 rounded ml-2">x{o.quantity || 1}</span></span>
                          <span className="text-slate-900 font-mono">{o.price} <span className="text-[8px] opacity-30">EGP</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-8 mt-6 border-t-2 border-dashed border-slate-200 flex flex-col items-center gap-2">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">المبلغ النهائي للتحصيل</span>
                  <div className="relative">
                    <div className="absolute inset-x-0 bottom-2 h-4 bg-emerald-500/10 -rotate-1 rounded-full blur-[4px]" />
                    <p className="text-4xl md:text-6xl font-black text-emerald-600 relative z-10 italic">
                      {checkoutBill.totalAmount} 
                      <span className="text-lg md:text-xl opacity-30 ml-3 not-italic">EGP</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setCheckoutBill(null)}
                  className="py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl hover:bg-black hover:-translate-y-1 active:scale-95 transition-all text-sm"
                >
                  تحصيل المبلـغ
                </button>
                <button
                  onClick={() => window.print()}
                  className="py-5 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all text-sm"
                >
                  طباعة التذكرة
                </button>
              </div>
            </div>
        )}
      </Modal>
    </div>
  );
};
