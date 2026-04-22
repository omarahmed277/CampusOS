import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Users, ArrowRight, X, Loader2, CheckCircle2, AlertCircle, Calendar, Plus, Edit, Receipt, Printer, Briefcase, DollarSign, Phone, Smartphone } from 'lucide-react';
import { createPortal } from 'react-dom';
import { RoomsDatabase } from './RoomsDatabase';

interface Room {
  id: string;
  name_ar: string;
  code: string;
  color: string;
  base_price: number;
  is_active: boolean;
  current_session?: any;
}

export const RoomsStatus = ({ branchId }: { branchId?: string }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'analysis' | 'database'>('status');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [servingRoom, setServingRoom] = useState<Room | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  
  // State for session opening
  const [userCode, setUserCode] = useState('');
  const [userName, setUserName] = useState('');
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);

  // Receipt State
  const [showReceipt, setShowReceipt] = useState<any>(null);

  // Catering Items Handling
  const [inventory, setInventory] = useState<any[]>([]);
  const [showCateringEntry, setShowCateringEntry] = useState<any>(null);
  const [tempOrders, setTempOrders] = useState<any[]>([]);
  const [editingHistoryItem, setEditingHistoryItem] = useState<any>(null);

  // Manual Override States
  // Manual Override States
  const [overrideDuration, setOverrideDuration] = useState('');
  const [overrideRoomAmount, setOverrideRoomAmount] = useState('');
  const [overrideStartTime, setOverrideStartTime] = useState('');
  const [overrideEndTime, setOverrideEndTime] = useState('');
  const [partnerCode, setPartnerCode] = useState('');

  const handlePrintA4Receipt = () => {
       const customerName = prompt("أدخل اسم العميل (الذي سيظهر في الفاتورة):", showReceipt.userName);
       if (customerName === null) return;
       const nameDisplay = document.getElementById(`client-name-display`);
       if (nameDisplay) nameDisplay.innerText = customerName;
       const receiptContent = document.getElementById(`printable-receipt`);
       if (!receiptContent) return;
       const iframe = document.createElement(`iframe`);
       iframe.style.display = `none`;
       document.body.appendChild(iframe);
       const iframeDoc = iframe.contentWindow?.document;
       if (!iframeDoc) return;
       const styles = Array.from(document.querySelectorAll(`style, link[rel="stylesheet"]`)).map(style => style.outerHTML).join(``);
       iframeDoc.open();
       iframeDoc.write(`
           <html>
               <head>
                   <title>A4 Receipt</title>
                   ${styles}
                   <style>
                       @page { size: A4; margin: 0; }
                       body { margin: 0; padding: 0; background: white; font-family: "Cairo", sans-serif; }
                       #printable-receipt { 
                           display: flex !important;
                           flex-direction: column !important;
                           visibility: visible !important;
                           width: 210mm !important; 
                           height: 297mm !important; 
                           padding: 12mm 15mm !important; 
                           margin: 0 auto !important; 
                           background: white !important; 
                           box-sizing: border-box; 
                       }
                       #printable-receipt * { visibility: visible !important; }
                   </style>
               </head>
               <body dir="rtl">
                   <div id="printable-receipt">
                       ${receiptContent.innerHTML}
                   </div>
               </body>
           </html>
       `);
       iframeDoc.close();
       setTimeout(() => {
           iframe.contentWindow?.focus();
           iframe.contentWindow?.print();
           setTimeout(() => { document.body.removeChild(iframe); }, 1000);
       }, 500);
   };

  const [editingLiveSession, setEditingLiveSession] = useState<any>(null);

  useEffect(() => {
    if (branchId) {
      if (activeTab === 'status') {
        fetchRoomsStatus();
        fetchInventory();
      }
      else fetchHistory();
      
      const channel = supabase
        .channel('rooms-status-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_sessions' }, () => {
          if (activeTab === 'status') fetchRoomsStatus();
          else fetchHistory();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [branchId, activeTab]);

  // Effect to pre-fill modal when servingRoom changes
  useEffect(() => {
    if (servingRoom) {
      const now = new Date();
      const formatToDateTimeLocal = (date: Date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
      }
      
      const next = checkFutureBooking(servingRoom.id);
      if (next) {
        setUserName(next.user_name || next.customers?.full_name || '');
        setUserCode(next.user_code || '');
        
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(next.start_time/60), next.start_time%60);
        const end = new Date(start.getTime() + (next.duration || 1) * 60 * 60 * 1000);
        setStartTimeInput(formatToDateTimeLocal(start));
        setEndTimeInput(formatToDateTimeLocal(end));
      } else {
        setUserName('');
        setUserCode('');
        
        setStartTimeInput(formatToDateTimeLocal(now));
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        setEndTimeInput(formatToDateTimeLocal(nextHour));
      }
    }
  }, [servingRoom]);

  const fetchRoomsStatus = async () => {
    if (!branchId) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data: roomsData } = await (supabase.from('services') as any).select('*').eq('branch_id', branchId).ilike('service_type', 'room').eq('is_active', true).order('code', { ascending: true });
      const { data: activeSessions } = await (supabase.from('workspace_sessions') as any).select('*, customers(full_name, phone)').eq('branch_id', branchId).neq('status', 'completed');
      const { data: todayBookings } = await (supabase.from('bookings') as any).select('*, customers(full_name, phone, code)').eq('branch_id', branchId).eq('booking_date', today).eq('status', 'Confirmed');

      setBookings(todayBookings || []);
      const roomsWithStatus = (roomsData || []).map((r: any) => ({
        ...r,
        current_session: activeSessions?.find((s: any) => s.service_id === r.id)
      }));
      setRooms(roomsWithStatus);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const { data } = await (supabase.from('workspace_sessions') as any)
        .select('*, services(name_ar, code, base_price), customers(full_name)')
        .eq('branch_id', branchId)
        .eq('status', 'completed')
        .not('service_id', 'is', null) // Only room sessions
        .order('end_time', { ascending: false })
        .limit(50);
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (!branchId) return;
    try {
      const { data } = await supabase.from('inventory').select('*').eq('branch_id', branchId).gt('stock', 0);
      setInventory(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const handleStartServing = async () => {
    if (!servingRoom) return;
    setProcessing(true);
    try {
      let customerId = null;
      let finalUserCode = userCode || servingRoom.code || `GUEST-${Date.now().toString().slice(-4)}`;
      let finalUserName = userName || `${servingRoom.code} - ${servingRoom.name_ar}`;
      let finalPhone = 'N/A';
      let partnerId = null;

      if (partnerCode) {
        const { data: pData } = await supabase.from('partners').select('id').ilike('partner_code', partnerCode.trim()).eq('status', 'Active').maybeSingle();
        if (pData) partnerId = pData.id;
      }
      
      if (userCode) {
        const { data: customer } = await supabase.from('customers').select('id, code, phone, full_name').eq('code', userCode.toUpperCase()).maybeSingle();
        if (customer) {
            customerId = customer.id;
            finalUserCode = customer.code;
            finalUserName = customer.full_name;
            finalPhone = customer.phone;
        }
      }

      const startTime = new Date(startTimeInput || new Date().toISOString());
      const endTime = new Date(endTimeInput || new Date(startTime.getTime() + 60 * 60 * 1000).toISOString());

      const { error } = await supabase.from('workspace_sessions').insert({
        branch_id: branchId,
        service_id: servingRoom.id,
        customer_id: customerId,
        user_code: finalUserCode.toUpperCase(),
        user_name: finalUserName,
        phone_number: finalPhone,
        partner_id: partnerId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'active',
        hourly_price: servingRoom.base_price,
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      setServingRoom(null);
      setUserCode('');
      setUserName('');
      setPartnerCode('');
      setStartTimeInput('');
      setEndTimeInput('');
      fetchRoomsStatus();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEndServing = (room: Room) => {
    const session = room.current_session;
    if (!session) return;
    
    const start = new Date(session.start_time);
    const end = new Date();
    let diffMins = Math.ceil(Math.abs(end.getTime() - start.getTime()) / 60000);
    if (diffMins === 0) diffMins = 1;
    
    // Use the session's hourly price if available, otherwise the room's base price
    const currentHourlyPrice = session.hourly_price || room.base_price;
    const initialAmount = Math.ceil((diffMins/60) * currentHourlyPrice);
    const hours = parseFloat((diffMins / 60).toFixed(2));
    
    setTempOrders([]);
    setOverrideDuration(hours.toString());
    setOverrideRoomAmount(initialAmount.toString());
    setOverrideStartTime(session.start_time);
    setOverrideEndTime(end.toISOString());
    setShowCateringEntry({
      room,
      session: { ...session, hourly_price: currentHourlyPrice }
    });
  };

  const updatePaymentMethod = async (sessionId: string, method: string) => {
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ payment_method: method })
        .eq('id', sessionId);
      if (error) throw error;
      if (showReceipt && showReceipt.sessionId === sessionId) {
        setShowReceipt({ ...showReceipt, payment_method: method });
      }
    } catch (err) {
      console.error('Error updating payment method:', err);
    }
  };

  const finalizeEndServing = async () => {
    if (!showCateringEntry) return;
    const { room, session } = showCateringEntry;
    
    setProcessing(true);
    try {
      const startTime = new Date(overrideStartTime || session.start_time);
      const endTime = new Date(overrideEndTime || new Date().toISOString());
      
      const totalHours = parseFloat(overrideDuration) || 0;
      const workspaceAmount = parseFloat(overrideRoomAmount) || 0;
      const cateringAmount = tempOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
      const totalAmount = workspaceAmount + cateringAmount;
      
      const { error: sessionError } = await (supabase.from('workspace_sessions' as any) as any)
          .update({ 
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(), 
              status: 'completed',
              total_minutes: Math.round(totalHours * 60),
              total_amount: totalAmount,
              catering_amount: cateringAmount,
              orders: tempOrders
          })
          .eq('id', session.id);

      if (sessionError) throw sessionError;

      // --- Financial Rewards (Loyalty & Partner Cashback) ---
      // 1. Award Loyalty Points to Customer
      if (session.customer_id) {
          const pointsAwarded = Math.floor(totalAmount);
          const { data: currentCust } = await supabase.from('customers').select('loyalty_points').eq('id', session.customer_id).single();
          if (currentCust) {
              await supabase.from('customers').update({ 
                  loyalty_points: (currentCust.loyalty_points || 0) + pointsAwarded 
              }).eq('id', session.customer_id);
          }
      }

      // 2. Award Cashback to Partner
      if (session.partner_id) {
          const { data: partnerData } = await supabase.from('partners').select('*').eq('id', session.partner_id).single();
          if (partnerData) {
              const cashback = Number(((workspaceAmount * (partnerData.cashback_rate || 0)) / 100).toFixed(2));
              if (cashback > 0) {
                  await supabase.from('partners').update({
                      total_earned: (Number(partnerData.total_earned) || 0) + cashback
                  } as any).eq('id', session.partner_id);
              }
          }
      }

      // Deduct from inventory
      for (const order of tempOrders) {
        if (order.inventory_id) {
           const { data: currentItem } = await supabase.from('inventory').select('stock').eq('id', order.inventory_id).single();
           if (currentItem) {
              await supabase.from('inventory').update({ stock: Math.max(0, currentItem.stock - order.quantity) }).eq('id', order.inventory_id);
           }
        }
      }

      // Show Receipt
      setShowReceipt({
        sessionId: session.id,
        roomName: room.name_ar,
        roomCode: room.code,
        userName: session.user_name || 'عميل',
        userCode: session.user_code,
        startTime: session.start_time,
        endTime: endTime.toISOString(),
        duration: Math.round(totalHours * 60),
        rate: room.base_price,
        workspaceAmount,
        cateringAmount,
        items: tempOrders,
        total: totalAmount
      });

      setShowCateringEntry(null);
      fetchRoomsStatus();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const addItemToTemp = (item: any) => {
    setTempOrders(prev => {
      const existing = prev.find(o => o.inventory_id === item.id);
      if (existing) {
        return prev.map(o => o.inventory_id === item.id ? { ...o, quantity: o.quantity + 1 } : o);
      }
      return [...prev, { name: item.name, price: item.selling_price || item.price, quantity: 1, inventory_id: item.id }];
    });
  };

  const removeItemFromTemp = (id: string) => {
    setTempOrders(prev => prev.filter(o => o.inventory_id !== id));
  };

  const handleUpdateHistoryItem = async (updatedData: any) => {
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({
          user_name: updatedData.user_name,
          user_code: updatedData.user_code,
          start_time: updatedData.start_time,
          end_time: updatedData.end_time,
          total_minutes: parseInt(updatedData.total_minutes),
          total_amount: parseFloat(updatedData.total_amount)
        })
        .eq('id', updatedData.id);

      if (error) throw error;
      setEditingHistoryItem(null);
      fetchHistory();
    } catch (err: any) {
      alert('Error updating: ' + err.message);
    }
  };

  const handleUpdateLiveSession = async (updatedData: any) => {
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({
          user_name: updatedData.user_name,
          user_code: updatedData.user_code,
          start_time: updatedData.start_time,
          end_time: updatedData.end_time,
          hourly_price: parseFloat(updatedData.hourly_price) || 0
        })
        .eq('id', updatedData.id);

      if (error) throw error;
      setEditingLiveSession(null);
      fetchRoomsStatus();
    } catch (err: any) {
      alert('Error updating: ' + err.message);
    }
  };

  const checkFutureBooking = (roomId: string) => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    const next = bookings
      .filter(b => b.service_id === roomId && (b.start_time + b.duration * 60) > nowMinutes)
      .sort((a, b) => a.start_time - b.start_time)[0];
    return next;
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? 'م' : 'ص';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const getRoomColor = (color: string) => {
    switch (color?.toLowerCase()) {
      case 'blue': return 'bg-[#1E75B9]/10 text-[#1E75B9] shadow-[#1E75B9]/20';
      case 'orange': return 'bg-[#F78C2A]/10 text-[#F78C2A] shadow-[#F78C2A]/20';
      case 'red': return 'bg-[#F83854]/10 text-[#F83854] shadow-[#F83854]/20';
      case 'green': return 'bg-[#1ED788]/10 text-[#1ED788] shadow-[#1ED788]/20';
      default: return 'bg-indigo-100 text-indigo-600 shadow-indigo-100/50';
    }
  };

  const handleQuickOpen = () => {
    const room = rooms.find(r => r.code.toUpperCase() === roomCodeInput.toUpperCase());
    if (room) {
      if (room.current_session) {
        alert('هذه الغرفة مشغولة حالياً');
      } else {
        setServingRoom(room);
        setRoomCodeInput('');
      }
    } else {
      alert('كود الغرفة غير صحيح');
    }
  };

  return (
    <div className="space-y-10 font-['Cairo'] text-right pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">إدارة حالة الغرف</h2>
          <div className="flex items-center gap-6 mt-2">
            <button 
              onClick={() => setActiveTab('status')}
              className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'status' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
              الحالة الحالية
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
              سجل الحجوزات
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
              تحليل البيانات
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'database' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}
            >
              قاعدة الغرف والأسعار
            </button>
          </div>
        </div>

        {activeTab === 'status' && (
          <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-full md:w-auto overflow-hidden group focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
            <input 
              type="text" 
              placeholder="ادخل كود الغرفة (R1)..." 
              className="flex-1 min-w-[200px] border-none outline-none px-6 py-2 font-black text-slate-700 uppercase"
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickOpen()}
            />
            <button 
              onClick={handleQuickOpen}
              className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-indigo-600 active:scale-[0.98] transition-all"
            >
              فتح سريع
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-slate-50 rounded-[3rem] animate-pulse"></div>)}
        </div>
      ) : activeTab === 'database' ? (
        <div className="animate-in fade-in slide-in-from-bottom-5">
           <RoomsDatabase branchId={branchId} />
        </div>
      ) : activeTab === 'status' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {rooms.map(room => {
            const isOccupied = !!room.current_session;
            const nextBooking = checkFutureBooking(room.id);
            
            return (
              <div key={room.id} className={`group relative bg-white rounded-[3.5rem] border-2 transition-all duration-500 hover:shadow-2xl flex flex-col ${isOccupied ? 'border-rose-100 shadow-sm' : 'border-slate-50 hover:border-indigo-100'}`}>
                <div className="p-8 pb-6 flex justify-between items-start">
                   <div className={`w-16 h-16 shrink-0 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-xl transition-all group-hover:scale-110 ${getRoomColor(room.color)}`}>
                     {room.code}
                   </div>
                   <div className="flex flex-col items-end gap-2">
                       <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isOccupied ? 'bg-rose-50 border border-rose-200 text-rose-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
                         {isOccupied ? 'مفتوحة حالياً' : 'متاحة الآن'}
                       </span>
                       {nextBooking && !isOccupied && (
                          <span className="flex items-center gap-1.5 text-amber-600 font-bold text-[10px] bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                             <Calendar size={12} />
                             الحجز القادم: {formatTime(nextBooking.start_time)}
                          </span>
                       )}
                   </div>
                </div>

                <div className="px-8 pb-8 flex flex-col flex-1 gap-6">
                  <div>
                      <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2 pr-3 border-r-4 border-indigo-500">{room.name_ar}</h3>
                      <div className="flex items-center gap-2 text-slate-400 font-bold text-sm pr-3">
                        <Clock size={16} />
                        <span>{room.base_price} EGP / سـاعة</span>
                      </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-end">
                    {isOccupied ? (
                      <div className="space-y-4">
                         <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 group/info hover:border-indigo-200 hover:shadow-md transition-all relative mt-2">
                            <button 
                              onClick={() => setEditingLiveSession(room.current_session)} 
                              className="absolute top-4 left-4 p-2 text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg shadow-sm transition-all active:scale-95 z-10"
                              title="تعديل تفاصيل ووقت الجلسة"
                            >
                               <Edit size={16} />
                            </button>
                            <div className="flex flex-col gap-1 mb-4 border-b border-slate-200/60 pb-3">
                               <span className="text-[10px] text-slate-400 font-black uppercase">بيانات العميل / القاعة</span>
                               <span className="text-base font-black text-slate-800 break-words leading-tight ml-8">
                                 {room.current_session.user_name || room.name_ar || 'عميل'}
                               </span>
                            </div>
                            <div className="flex flex-col gap-1">
                               <span className="text-[10px] text-slate-400 font-black uppercase">وقت البدء</span>
                               <span className="text-sm font-black text-indigo-600">{new Date(room.current_session.start_time).toLocaleTimeString('ar-EG', { hour12: true, hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                         </div>
                         <button onClick={() => handleEndServing(room)} disabled={processing} className="w-full bg-rose-500 text-white py-4 rounded-[1.5rem] font-black text-sm hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 active:scale-95">
                            إنهاء ومحاسبة
                         </button>
                      </div>
                    ) : (
                      <div className="mt-6">
                         <button onClick={() => setServingRoom(room)} className="w-full h-[120px] bg-slate-50 text-slate-400 border-2 border-slate-100 border-dashed rounded-[2.5rem] font-black hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-2 active:scale-95">
                            <ArrowRight size={24} />
                            <span>تسجيل التسكين الآن</span>
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'history' ? (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5">
           <table className="w-full text-right">
             <thead className="bg-slate-50">
               <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <th className="px-8 py-6">الغرفة</th>
                 <th className="px-8 py-6">العميل</th>
                 <th className="px-8 py-6">التاريخ والوقت</th>
                 <th className="px-8 py-6">المدة</th>
                 <th className="px-8 py-6">المبلغ</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                {history.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group/row">
                    <td className="px-8 py-5">
                       <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black">{item.services?.name_ar || 'غرفة'}</span>
                       {item.services?.code && <span className="mr-2 text-[10px] text-slate-400 font-bold">({item.services.code})</span>}
                    </td>
                    <td className="px-8 py-5">
                       <div>{item.user_name || item.customers?.full_name || item.services?.name_ar || 'عميل'}</div>
                       <div className="text-[10px] text-slate-400 uppercase mt-0.5">{item.user_code}</div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="text-xs">{new Date(item.end_time).toLocaleDateString('ar-EG')}</div>
                       <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                         {new Date(item.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       {(item.total_minutes / 60).toFixed(1)} ساعة
                       <div className="text-[10px] text-slate-400 mt-0.5">({item.total_minutes} دقيقة)</div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex items-center justify-between">
                          <span className="text-indigo-600 font-black">{item.total_amount} EGP</span>
                          <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                             <button 
                               onClick={() => setShowReceipt({
                                  roomName: item.services?.name_ar || 'غرفة',
                                  roomCode: item.services?.code,
                                  userName: item.user_name || item.customers?.full_name || item.services?.name_ar || 'عميل',
                                  userCode: item.user_code,
                                  startTime: item.start_time,
                                  endTime: item.end_time,
                                  duration: item.total_minutes,
                                  rate: item.services?.base_price || 0,
                                  workspaceAmount: item.total_amount - (item.catering_amount || 0),
                                  cateringAmount: item.catering_amount || 0,
                                  items: item.orders || [],
                                  total: item.total_amount
                               })}
                               className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                               title="عرض الفاتورة"
                             >
                                <Receipt size={16} />
                             </button>
                             <button 
                               onClick={() => setEditingHistoryItem(item)}
                               className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-colors"
                               title="تعديل الجلسة"
                             >
                                <Edit size={16} />
                             </button>
                             <button 
                               onClick={() => {
                                 if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                                   supabase.from('workspace_sessions').delete().eq('id', item.id).then(() => fetchHistory());
                                 }
                               }}
                               className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                             >
                                <X size={14} />
                             </button>
                          </div>
                       </div>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">لا يوجد سجل عمليات سابقة</td>
                  </tr>
                )}
             </tbody>
           </table>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-5 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                       <DollarSign size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الإيرادات</p>
                 </div>
                 <h4 className="text-3xl font-black text-slate-900 tabular-nums">{history.reduce((sum: any, h: any) => sum + (h.total_amount || 0), 0).toLocaleString()} <span className="text-sm opacity-30">EGP</span></h4>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                       <Users size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">عدد الجلسات</p>
                 </div>
                 <h4 className="text-3xl font-black text-slate-900 tabular-nums">{history.length}</h4>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <Clock size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الساعات</p>
                 </div>
                 <h4 className="text-3xl font-black text-slate-900 tabular-nums">{(history.reduce((sum: any, h: any) => sum + (Number(h.total_minutes) || 0), 0) / 60).toFixed(1)}</h4>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:bg-rose-600 group-hover:text-white transition-all">
                       <CheckCircle2 size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">متوسط الجلسة</p>
                 </div>
                 <h4 className="text-3xl font-black text-slate-900 tabular-nums">
                    {history.length > 0 ? (history.reduce((sum: any, h: any) => sum + (h.total_amount || 0), 0) / history.length).toFixed(1) : 0} <span className="text-sm opacity-30">EGP</span>
                 </h4>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Methods Distribution */}
              <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-10 overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10 opacity-50" />
                 <h3 className="text-xl font-black text-slate-800 mb-8 pr-4 border-r-4 border-emerald-500">طرق التحصيل والدفع</h3>
                 <div className="space-y-6">
                    {[
                      { id: 'cash', label: 'كاش', color: 'bg-emerald-500', icon: <DollarSign size={14} />, text: 'text-emerald-600' },
                      { id: 'vfcash', label: 'فودافون كاش', color: 'bg-rose-500', icon: <Phone size={14} />, text: 'text-rose-600' },
                      { id: 'instapay', label: 'InstaPay', color: 'bg-indigo-500', icon: <Smartphone size={14} />, text: 'text-indigo-600' },
                      { id: 'subscription', label: 'اشتراكات', color: 'bg-amber-500', icon: <Clock size={14} />, text: 'text-amber-600' },
                      { id: 'corporate', label: 'شركات', color: 'bg-slate-900', icon: <Briefcase size={14} />, text: 'text-slate-900' }
                    ].map(method => {
                       const matches = history.filter((h: any) => h.payment_method === method.id || (method.id === 'cash' && !h.payment_method));
                       const total = matches.reduce((sum: any, h: any) => sum + (h.total_amount || 0), 0);
                       const count = matches.length;
                       const pct = history.length > 0 ? (count / history.length) * 100 : 0;

                       return (
                          <div key={method.id} className="group">
                             <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                   <div className={`p-2 rounded-lg ${method.color} text-white shadow-sm`}>{method.icon}</div>
                                   <span className="font-black text-slate-800 text-sm">{method.label}</span>
                                </div>
                                <div className="text-right">
                                   <span className={`text-sm font-black ${method.text}`}>{total.toLocaleString()} EGP</span>
                                   <span className="text-[10px] text-slate-300 font-bold mx-2">/ {count} تحصيل</span>
                                </div>
                             </div>
                             <div className="h-3 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${method.color}`} 
                                  style={{ width: `${pct || 1}%` }} 
                                />
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              {/* Room Usage */}
              <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-10 overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -z-10 opacity-50" />
                 <h3 className="text-xl font-black text-slate-800 mb-8 pr-4 border-r-4 border-indigo-600">تحليل إستخدام الغرف</h3>
                 <div className="space-y-6">
                    {rooms.map(room => {
                        const roomSessions = history.filter((h: any) => h.service_id === room.id);
                        const roomRevenue = roomSessions.reduce((sum: any, h: any) => sum + (h.total_amount || 0), 0);
                        const usagePct = history.length > 0 ? (roomSessions.length / history.length) * 100 : 0;
                        
                        return (
                           <div key={room.id} className="group">
                              <div className="flex justify-between items-end mb-2">
                                 <div>
                                    <span className="text-sm font-black text-slate-800">{room.name_ar}</span>
                                    <span className="mr-3 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 uppercase">{room.code}</span>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-xs font-black text-indigo-600">{roomRevenue.toLocaleString()} EGP</span>
                                    <span className="mx-2 text-slate-200">|</span>
                                    <span className="text-[10px] font-bold text-slate-500">{roomSessions.length} جلسة</span>
                                 </div>
                              </div>
                              <div className="h-3 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                                 <div 
                                   className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-sm" 
                                   style={{ width: `${usagePct || 1}%` }}
                                 />
                              </div>
                           </div>
                        );
                    })}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Manual Serve Modal */}
      {servingRoom && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 border border-white/20">
            <div className="bg-slate-900 p-12 flex justify-between items-center text-white relative">
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
               <div className="relative z-10">
                  <h3 className="text-4xl font-black">{servingRoom.name_ar}</h3>
                  <p className="text-slate-400 font-bold mt-1 tracking-widest uppercase">بدء جلسة جديدة (Code: {servingRoom.code})</p>
               </div>
               <button onClick={() => setServingRoom(null)} className="relative z-10 p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <div className="p-12 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase mr-3 tracking-widest">كود العميل</label>
                     <input 
                       type="text" 
                       placeholder="#CUS-123" 
                       className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all uppercase" 
                       value={userCode} 
                       onChange={e => setUserCode(e.target.value)} 
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase mr-3 tracking-widest">اسم العميل</label>
                     <input 
                       type="text" 
                       placeholder="الاسم الكامل" 
                       className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all" 
                       value={userName} 
                       onChange={e => setUserName(e.target.value)} 
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-emerald-500 uppercase mr-3 tracking-widest">كود النشاط (شريك)</label>
                     <div className="relative group">
                         <input 
                           type="text" 
                           placeholder="GDSC" 
                           className="w-full h-14 bg-emerald-50/30 border-2 border-emerald-100/50 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-emerald-500 transition-all uppercase" 
                           value={partnerCode} 
                           onChange={e => setPartnerCode(e.target.value)} 
                         />
                         <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase mr-3 tracking-widest">وقت البدء</label>
                     <input 
                       type="datetime-local" 
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center" 
                       value={startTimeInput} 
                       onChange={e => setStartTimeInput(e.target.value)} 
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase mr-3 tracking-widest">وقت الانتهاء المتوقع</label>
                     <input 
                       type="datetime-local" 
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center" 
                       value={endTimeInput} 
                       onChange={e => setEndTimeInput(e.target.value)} 
                     />
                  </div>
               </div>

               {checkFutureBooking(servingRoom.id) && (
                  <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-[2.5rem] flex items-start gap-4 animate-pulse">
                     <div className="bg-amber-500 text-white p-2 rounded-xl">
                        <Calendar size={20} />
                     </div>
                     <div>
                        <p className="text-amber-900 font-black text-sm">تنبيه: حجز مؤكد الآن</p>
                        <p className="text-amber-700 text-[11px] font-bold mt-1 leading-relaxed">
                          هذه الغرفة محجوزة للعميل <span className="underline">{checkFutureBooking(servingRoom.id).user_name || checkFutureBooking(servingRoom.id).customers?.full_name}</span> من الساعة {formatTime(checkFutureBooking(servingRoom.id).start_time)}
                        </p>
                     </div>
                  </div>
               )}

               <button 
                 onClick={handleStartServing}
                 disabled={processing}
                 className="w-full bg-indigo-600 text-white h-24 rounded-[2.5rem] font-black text-xl hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-200 mt-4 disabled:opacity-50"
               >
                 {processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                 تأكيد وفتح الغرفة
               </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Catering Entry Modal Before Ending Session */}
      {showCateringEntry && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in">
           <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh]">
              {/* Product List */}
              <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-slate-800">إضافة طلبات الكافتريا</h3>
                    <div className="text-[10px] font-black uppercase text-slate-400 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">{showCateringEntry.room.name_ar}</div>
                 </div>
                 
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {inventory.map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => addItemToTemp(item)}
                        className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-500 hover:shadow-xl transition-all text-right group relative overflow-hidden"
                      >
                         <div className="bg-indigo-50 p-2 rounded-lg w-fit mb-3 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                            <Plus size={16} />
                         </div>
                         <p className="font-black text-slate-800 text-sm mb-1">{item.name}</p>
                         <p className="text-indigo-600 font-bold text-xs">{item.selling_price || item.price} EGP</p>
                         <div className="mt-2 text-[9px] text-slate-400 font-bold">المتاح: {item.stock}</div>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Order Summary Sidebar */}
              <div className="w-full md:w-96 bg-white border-r border-slate-100 flex flex-col p-8">
                 <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setShowCateringEntry(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                    <div className="flex flex-col items-end">
                       <h4 className="font-black text-slate-900">ملخص الفاتورة</h4>
                       <p className="text-[9px] text-slate-400 uppercase tracking-widest">Billing Summary</p>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto space-y-4 mb-8">
                    {tempOrders.map(order => (
                       <div key={order.inventory_id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl group animate-in slide-in-from-left-2">
                          <button onClick={() => removeItemFromTemp(order.inventory_id)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><X size={14} /></button>
                          <div className="text-right">
                             <p className="font-black text-slate-800 text-xs">{order.name}</p>
                             <p className="text-[10px] text-slate-400 font-bold">{order.quantity} × {order.price} EGP</p>
                          </div>
                       </div>
                    ))}
                    {tempOrders.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60 italic py-10">
                         <div className="w-12 h-12 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-2"><Plus size={16} /></div>
                         <p className="text-xs">لا توجد طلبات كافتريا</p>
                      </div>
                    )}
                 </div>

                 <div className="space-y-4 border-t border-slate-50 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase pr-2">وقت البدء</label>
                           <input 
                             type="datetime-local" 
                             className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-black text-[10px] h-10 text-center"
                             value={overrideStartTime ? new Date(new Date(overrideStartTime).getTime() - new Date(overrideStartTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                             onChange={e => setOverrideStartTime(new Date(e.target.value).toISOString())}
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase pr-2">وقت الانتهاء</label>
                           <input 
                             type="datetime-local" 
                             className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-black text-[10px] h-10 text-center"
                             value={overrideEndTime ? new Date(new Date(overrideEndTime).getTime() - new Date(overrideEndTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                             onChange={e => setOverrideEndTime(new Date(e.target.value).toISOString())}
                           />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase pr-2">المدة (بالساعات)</label>
                          <input 
                            type="number" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-black text-xs h-10"
                            value={overrideDuration}
                            onChange={e => setOverrideDuration(e.target.value)}
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase pr-2">حساب الغرفة (EGP)</label>
                          <input 
                            type="number" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-black text-xs h-10"
                            value={overrideRoomAmount}
                            onChange={e => setOverrideRoomAmount(e.target.value)}
                          />
                       </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 pt-2">
                       <span>إجمالي الكافتريا</span>
                       <span className="font-black text-slate-700">{tempOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0)} EGP</span>
                    </div>

                    <div className="bg-indigo-600 p-4 rounded-2xl flex justify-between items-center text-white">
                       <span className="text-xs font-black uppercase opacity-60">الإجمالي النهائي</span>
                       <span className="text-xl font-black">
                          {(parseFloat(overrideRoomAmount || '0') + tempOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0)).toFixed(2)} EGP
                       </span>
                    </div>

                    <div className="pt-2">
                       <button 
                         onClick={finalizeEndServing} 
                         disabled={processing}
                         className="w-full bg-slate-900 text-white h-16 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200"
                        >
                          {processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                          إنهاء الجلسة والدفع
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      , document.body)}

      {/* Enhanced Receipt Modal */}
      {showReceipt && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in print:bg-white print:p-0">
           <div className="receipt-container bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none print:max-w-none">
              <div className="bg-slate-900 p-8 text-center text-white relative print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-100">
                  <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                      <button onClick={handlePrintA4Receipt} className="p-2 hover:bg-white/10 rounded-full transition-colors text-emerald-400" title="طباعة A4"><Printer size={20} /></button>
                      <button onClick={() => setShowReceipt(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                   </div>
                  <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4 print:text-slate-900" />
                  <h3 className="text-2xl font-black">فاتورة العميل</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 print:text-slate-500">Official Payment Receipt</p>
              </div>

              <div className="p-10 space-y-6">
                 {/* ID Section */}
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl text-right">
                    <div className="text-left">
                       <p className="text-[10px] text-slate-400 font-black uppercase">الخدمة</p>
                       <p className="font-black text-slate-800">{showReceipt.roomName}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-slate-400 font-black uppercase">العميل</p>
                       <p className="font-black text-slate-800">{showReceipt.userName} ({showReceipt.userCode})</p>
                    </div>
                 </div>

                 {/* Usage Section */}
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-2">تفاصيل استخدام الغرفة</h4>
                    <div className="bg-slate-50/50 rounded-2xl p-6 space-y-3 border border-slate-50">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                           <span>سعر الساعة</span>
                           <span className="text-slate-800">{showReceipt.rate} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                           <span>المدة الإجمالية</span>
                           <span className="text-slate-800">{(showReceipt.duration / 60).toFixed(1)} ساعة</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-black text-indigo-600 pt-2 border-t border-slate-100">
                           <span>حساب الغرفة</span>
                           <span>{showReceipt.workspaceAmount} EGP</span>
                        </div>
                    </div>
                 </div>

                 {/* Items Section */}
                 {showReceipt.items?.length > 0 && (
                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-2">طلبات الكافتريا</h4>
                       <div className="bg-slate-50/50 rounded-2xl p-6 space-y-3 border border-slate-50">
                          {showReceipt.items.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-500">
                                <span>{item.quantity} × {item.name}</span>
                                <span className="text-slate-800">{item.price * item.quantity} EGP</span>
                             </div>
                          ))}
                          <div className="flex justify-between items-center text-xs font-black text-indigo-600 pt-2 border-t border-slate-100">
                             <span>حساب الكافتريا</span>
                             <span>{showReceipt.cateringAmount} EGP</span>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* Grand Total */}
                 <div className="pt-6 border-t font-black">
                    <div className="flex justify-between items-end">
                       <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase">الإجمالي النهائي</p>
                          <p className="text-4xl text-indigo-600">{showReceipt.total} <span className="text-sm">EGP</span></p>
                       </div>
                       <div className="text-left text-[10px] text-slate-300">
                          {new Date(showReceipt.endTime).toLocaleString('ar-EG')}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 print:hidden pt-4">
                    <button 
                      onClick={handlePrintA4Receipt} /* PAYMENT */ 
                      className="flex-1 bg-white border-2 border-slate-900 text-slate-900 py-4 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all active:scale-95"
                    >
                       طباعة فاتورة (A4)
                    </button>
                    <button 
                      onClick={() => setShowReceipt(null)}
                      className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-slate-200"
                    >
                       إغلاق
                    </button>
                 </div>
              </div>
           </div>
        </div>
      , document.body)}
       {/* Edit History Modal */}
      {editingHistoryItem && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10">
              <div className="flex justify-between items-center mb-8">
                 <button onClick={() => setEditingHistoryItem(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
                 <div className="text-right">
                    <h3 className="text-xl font-black text-slate-900">تعديل سجل الجلسة</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{editingHistoryItem.services?.name_ar}</p>
                 </div>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">العميل</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-right"
                      value={editingHistoryItem.user_name || ''}
                      onChange={e => setEditingHistoryItem({ ...editingHistoryItem, user_name: e.target.value })}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">وقت البدء (ISO)</label>
                    <input 
                      type="datetime-local" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center"
                      value={new Date(editingHistoryItem.start_time).toISOString().slice(0, 16)}
                      onChange={e => setEditingHistoryItem({ ...editingHistoryItem, start_time: new Date(e.target.value).toISOString() })}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">المدة (بالساعات)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center"
                      value={editingHistoryItem.total_minutes}
                      onChange={e => setEditingHistoryItem({ ...editingHistoryItem, total_minutes: e.target.value })}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">المبلغ الإجمالي (EGP)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center"
                      value={editingHistoryItem.total_amount}
                      onChange={e => setEditingHistoryItem({ ...editingHistoryItem, total_amount: e.target.value })}
                    />
                 </div>

                 <button 
                  onClick={() => handleUpdateHistoryItem(editingHistoryItem)}
                  className="w-full bg-slate-900 text-white h-16 rounded-[2rem] font-black text-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 mt-4 active:scale-95"
                 >
                    حفظ التعديلات
                 </button>
              </div>
           </div>
        </div>
      , document.body)}

       {/* Edit Live Session Modal */}
      {editingLiveSession && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10">
              <div className="flex justify-between items-center mb-8">
                 <button onClick={() => setEditingLiveSession(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
                 <div className="text-right">
                    <h3 className="text-xl font-black text-slate-900">تعديل الجلسة النشطة</h3>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">العميل</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-right"
                      value={editingLiveSession.user_name || ''}
                      onChange={e => setEditingLiveSession({ ...editingLiveSession, user_name: e.target.value })}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">الكود (إن وجد)</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-right uppercase"
                      value={editingLiveSession.user_code || ''}
                      onChange={e => setEditingLiveSession({ ...editingLiveSession, user_code: e.target.value })}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase pr-2">وقت البدء</label>
                    <input 
                      type="datetime-local" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center"
                      value={editingLiveSession.start_time ? new Date(new Date(editingLiveSession.start_time).getTime() - new Date(editingLiveSession.start_time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                      onChange={e => setEditingLiveSession({ ...editingLiveSession, start_time: new Date(e.target.value).toISOString() })}
                    />
                 </div>

                  
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase pr-2">وقت الانتهاء المتوقع</label>
                     <input 
                       type="datetime-local" 
                       className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center"
                       value={editingLiveSession.end_time ? new Date(new Date(editingLiveSession.end_time).getTime() - new Date(editingLiveSession.end_time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                       onChange={e => setEditingLiveSession({ ...editingLiveSession, end_time: new Date(e.target.value).toISOString() })}
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-indigo-600 uppercase pr-2">سعر الساعة (EGP)</label>
                     <input 
                       type="number" 
                       className="w-full bg-indigo-50 border border-indigo-100 rounded-[1.5rem] px-6 py-4 font-black outline-none focus:border-indigo-500 transition-all text-center"
                       value={editingLiveSession.hourly_price || ''}
                       onChange={e => setEditingLiveSession({ ...editingLiveSession, hourly_price: e.target.value })}
                     />
                  </div>

                  <button 
                   onClick={() => handleUpdateLiveSession(editingLiveSession)}
                  className="w-full bg-slate-900 text-white h-16 rounded-[2rem] font-black text-sm hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 mt-4 active:scale-95"
                 >
                    تحديث بيانات الجلسة
                 </button>
              </div>
           </div>
        </div>
      , document.body)}
      {/* Printable Receipt Portal Container (A4 Redesign) */}
      {showReceipt && createPortal(
        <div id="printable-receipt" className="relative h-full" style={{ display: 'none' }}>
          {/* Header Context Bar */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-10">
             <div>{new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</div>
             <div className="absolute left-1/2 -translate-x-1/2 uppercase tracking-widest opacity-60">Cloud Co-Working Space</div>
          </div>

          {/* Watermark Logo */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none select-none">
             <img src="/logo.png" alt="watermark" className="w-[300px] grayscale" />
          </div>

          {/* Main Header */}
          <div className="flex flex-col items-center justify-center mb-8 relative z-10">
             <div className="mb-4">
                <img src="/logo.png" alt="logo" className="h-20 object-contain" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 mb-1">فاتورة العميل</h1>
             <p className="text-[10px] font-bold tracking-[0.5em] text-slate-400 uppercase">OFFICIAL PAYMENT RECEIPT</p>
          </div>

          <div className="w-full h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent mb-8" />

          {/* Service Info Bar */}
          <div className="grid grid-cols-2 gap-20 mb-10 px-4 relative z-10">
             <div className="text-right">
                <p className="text-[10px] text-slate-400 font-extrabold mb-1 uppercase tracking-tighter">الخدمة / SERVICE</p>
                <div className="flex items-center gap-2 justify-end">
                   <p className="text-2xl font-black text-slate-900 leading-tight">{showReceipt.roomName}</p>
                   <div className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
             </div>
             <div className="text-left">
                <p className="text-[10px] text-slate-400 font-extrabold mb-1 uppercase tracking-tighter">العميل / CLIENT</p>
                <p className="text-2xl font-black text-slate-900 leading-tight" id="client-name-display">
                   {showReceipt.userName} {showReceipt.userCode ? `(${showReceipt.userCode})` : ''}
                </p>
             </div>
          </div>

          <div className="space-y-6 flex-1 text-right">
             {/* Room Details Section */}
             <div className="relative pt-2">
                <p className="text-[10px] font-black text-slate-900 mb-4 border-r-4 border-slate-900 pr-4">تفاصيل استخدام الغرفة</p>
                <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 space-y-4 text-right">
                   <div className="flex justify-between items-center text-base">
                      <span className="font-bold text-slate-500">سعر الساعة</span>
                      <span className="font-black text-slate-900">EGP {showReceipt.rate}</span>
                   </div>
                   <div className="flex justify-between items-center text-base">
                      <span className="font-bold text-slate-500">المدة الإجمالية</span>
                      <span className="font-black text-slate-900">{(showReceipt.duration / 60).toFixed(1)} ساعة</span>
                    </div>
                    <div className="h-px bg-slate-200 w-full" />
                    <div className="flex justify-between items-center pt-2">
                       <span className="text-lg font-black text-indigo-600">حساب الغرفة</span>
                       <span className="text-xl font-black text-indigo-600">EGP {showReceipt.workspaceAmount}</span>
                    </div>
                 </div>
              </div>

              {/* Catering Section */}
              {showReceipt.items && showReceipt.items.length > 0 && (
                <div className="relative pt-2">
                   <p className="text-[10px] font-black text-slate-900 mb-4 border-r-4 border-slate-900 pr-4">طلبات الكافتيريا</p>
                   <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 space-y-4 text-right">
                      {showReceipt.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-base">
                           <span className="font-bold text-slate-500">{item.quantity} × {item.name}</span>
                           <span className="font-black text-slate-700">EGP {Number(item.price) * item.quantity}</span>
                        </div>
                      ))}
                      <div className="h-px bg-slate-200 w-full" />
                      <div className="flex justify-between items-center pt-2">
                         <span className="text-lg font-black text-indigo-600">حساب الكافتيريا</span>
                         <span className="text-xl font-black text-indigo-600">EGP {showReceipt.cateringAmount}</span>
                      </div>
                   </div>
                </div>
              )}
           </div>

           {/* Final Summary Footer */}
           <div className="flex justify-between items-end mt-10 pt-8 border-t border-slate-100 font-sans">
              <div className="text-[10px] text-slate-400 font-bold mb-4 opacity-70 uppercase tracking-widest">
                 {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} | {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em] px-2">Total Amount Due</p>
                 <div className="bg-slate-900 text-white px-8 py-3 rounded-[2rem] flex items-baseline gap-3 justify-end shadow-2xl">
                    <span className="text-xs font-bold opacity-50 uppercase tracking-widest leading-none">EGP</span>
                    <span className="text-6xl font-black tracking-tighter tabular-nums leading-none">{showReceipt.total}</span>
                 </div>
              </div>
           </div>

          <div className="mt-8 text-center opacity-30">
             <p className="text-[10px] text-slate-900 uppercase tracking-[0.6em] font-black">Powered by CampusOS Cloud System</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// CSS for Print Fix
const printStyles = `
@media print {
  body * {
    visibility: hidden !important;
  }
  .receipt-container, .receipt-container * {
    visibility: visible !important;
  }
  .receipt-container {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: auto !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
  }
  .print\\:hidden {
    display: none !important;
  }
}
`;

// Inject Styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = printStyles;
  document.head.appendChild(style);
}
