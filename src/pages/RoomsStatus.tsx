import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Users, ArrowRight, X, Loader2, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [servingRoom, setServingRoom] = useState<Room | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  
  // State for session opening
  const [userCode, setUserCode] = useState('');
  const [userName, setUserName] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [processing, setProcessing] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (branchId) {
      fetchRoomsStatus();
      
      const channel = supabase
        .channel('rooms-status-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_sessions' }, () => fetchRoomsStatus())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchRoomsStatus())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [branchId]);

  const fetchRoomsStatus = async () => {
    if (!branchId) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data: roomsData } = await (supabase.from('services') as any).select('*').eq('branch_id', branchId).ilike('service_type', 'room').eq('is_active', true).order('code', { ascending: true });
      const { data: activeSessions } = await (supabase.from('workspace_sessions') as any).select('*, customers(full_name, phone)').eq('branch_id', branchId).neq('status', 'completed');
      const { data: todayBookings } = await (supabase.from('bookings') as any).select('*, customers(full_name)').eq('branch_id', branchId).eq('booking_date', today).eq('status', 'Confirmed');

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

  const handleStartServing = async () => {
    if (!servingRoom) return;
    setProcessing(true);
    try {
      let customerId = null;
      let finalUserCode = userCode || `GUEST-${Date.now().toString().slice(-4)}`;
      let finalUserName = userName;
      let finalPhone = 'N/A';
      
      if (userCode) {
        const { data: customer } = await supabase.from('customers').select('id, code, phone, full_name').eq('code', userCode).single();
        if (customer) {
            customerId = customer.id;
            finalUserCode = customer.code;
            finalUserName = customer.full_name;
            finalPhone = customer.phone;
        }
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (parseFloat(durationHours) || 1) * 60 * 60 * 1000);

      const { error } = await supabase.from('workspace_sessions').insert({
        branch_id: branchId,
        service_id: servingRoom.id,
        customer_id: customerId,
        user_code: finalUserCode,
        user_name: finalUserName,
        phone_number: finalPhone,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'active',
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      setServingRoom(null);
      setUserCode('');
      setUserName('');
      setDurationHours('1');
      fetchRoomsStatus();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEndServing = async (room: Room) => {
    const session = room.current_session;
    if (!session) return;
    
    if (!window.confirm(`هل تريد إنهاء الجلسة لـ ${room.name_ar}؟`)) return;
    
    setProcessing(true);
    try {
      const startTime = new Date(session.start_time);
      const endTime = new Date();
      const diffMs = Math.abs(endTime.getTime() - startTime.getTime());
      const diffMins = Math.ceil(diffMs / (1000 * 60));
      const hours = diffMins / 60;
      
      const totalSessionAmount = Math.ceil(hours * room.base_price);
      
      // Update session with final results
      const { error: sessionError } = await supabase
          .from('workspace_sessions')
          .update({ 
              end_time: endTime.toISOString(), 
              status: 'completed',
              total_minutes: diffMins,
              total_amount: totalSessionAmount
          })
          .eq('id', session.id);

      if (sessionError) throw sessionError;

      // Create a financial record (Bill)
      const { error: billError } = await (supabase as any).from('bills').insert({
          session_id: session.id,
          amount: totalSessionAmount,
          rate_per_hour: room.base_price,
          user_id: session.customer_id
      });
      
      if (billError) console.error('Error creating bill record:', billError);

      fetchRoomsStatus();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const checkFutureBooking = (roomId: string) => {
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const next = bookings
      .filter(b => b.service_id === roomId && b.start_time > nowMinutes)
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

  return (
    <div className="space-y-10 font-['Cairo'] text-right">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">إدارة حالة الغرف</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase text-xs tracking-[0.2em]">تحكم ذكي في مساحات العمل والاجتماعات</p>
        </div>

        <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-full md:w-auto">
          <input 
            type="text" 
            placeholder="ادخل كود الغرفة (R1)..." 
            className="flex-1 min-w-[200px] border-none outline-none px-6 py-2 font-black text-slate-700"
            value={roomCodeInput}
            onChange={e => setRoomCodeInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && rooms.find(r => r.code === roomCodeInput) && setServingRoom(rooms.find(r => r.code === roomCodeInput)!)}
          />
          <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all">
            فتح سريع
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-slate-50 rounded-[3rem] animate-pulse"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map(room => {
            const isOccupied = !!room.current_session;
            const nextBooking = checkFutureBooking(room.id);
            
            return (
              <div key={room.id} className={`group relative bg-white rounded-[3.5rem] border-2 transition-all duration-500 hover:shadow-2xl ${isOccupied ? 'border-rose-100' : 'border-slate-50 hover:border-indigo-100'}`}>
                <div className="p-10 flex justify-between items-start">
                   <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-xl ${getRoomColor(room.color)}`}>
                     {room.code}
                   </div>
                   <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isOccupied ? 'bg-rose-500 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}>
                     {isOccupied ? 'مشغول' : 'متاح حالياً'}
                   </div>
                </div>

                <div className="p-10 pt-0">
                  <h3 className="text-3xl font-black text-slate-800">{room.name_ar}</h3>
                  <div className="flex items-center gap-2 mt-2 text-slate-400 font-bold">
                    <Clock size={16} />
                    <span>{room.base_price} EGP / سـاعة</span>
                  </div>

                  {nextBooking && !isOccupied && (
                     <div className="mt-4 flex items-center gap-2 text-amber-600 font-black text-xs bg-amber-50 p-3 rounded-2xl border border-amber-100">
                        <Calendar size={14} />
                        <span>محجوز في {formatTime(nextBooking.start_time)}</span>
                     </div>
                  )}

                  {isOccupied ? (
                    <div className="mt-8 space-y-4">
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-[10px] text-slate-400 font-black uppercase">العميل</span>
                             <span className="text-sm font-black text-slate-700">{room.current_session.user_name || 'عميل'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-black">
                             <span className="text-slate-400 uppercase">المدة</span>
                             <span className="text-indigo-600">من {new Date(room.current_session.start_time).toLocaleTimeString('ar-EG', { hour12: true, hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                       </div>
                       <button onClick={() => handleEndServing(room)} disabled={processing} className="w-full bg-rose-500 text-white py-5 rounded-[2rem] font-black text-sm hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 disabled:opacity-50">
                          إنهاء الجلسة
                       </button>
                    </div>
                  ) : (
                    <div className="mt-10">
                       <button onClick={() => setServingRoom(room)} className="w-full h-32 bg-slate-50 text-slate-400 border-2 border-slate-50 border-dashed rounded-[2.5rem] font-black hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-2">
                          <ArrowRight size={24} />
                          <span>تجهيز الخدمة</span>
                       </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Serve Modal */}
      {servingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 border border-white/20">
            <div className="bg-slate-900 p-12 flex justify-between items-center text-white">
               <div>
                  <h3 className="text-4xl font-black">{servingRoom.name_ar}</h3>
                  <p className="text-slate-400 font-bold mt-1 tracking-widest uppercase">بدء جلسة جديدة (Code: {servingRoom.code})</p>
               </div>
               <button onClick={() => setServingRoom(null)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <div className="p-12 space-y-8">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <label className="text-xs font-black text-slate-500 uppercase mr-2 tracking-widest">كود العميل</label>
                     <input type="text" placeholder="#CUS-123" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 font-black outline-none focus:border-indigo-500 transition-all" value={userCode} onChange={e => setUserCode(e.target.value)} />
                  </div>
                  <div className="space-y-3">
                     <label className="text-xs font-black text-slate-500 uppercase mr-2 tracking-widest">اسم العميل</label>
                     <input type="text" placeholder="الاسم الكامل" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 font-black outline-none focus:border-indigo-500 transition-all" value={userName} onChange={e => setUserName(e.target.value)} />
                  </div>
               </div>

               <div className="space-y-3">
                  <label className="text-xs font-black text-slate-500 uppercase mr-2 tracking-widest">المدة المتوقعة (ساعات)</label>
                  <input type="number" min="0.5" step="0.5" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 font-black outline-none focus:border-indigo-500 transition-all" value={durationHours} onChange={e => setDurationHours(e.target.value)} />
               </div>

               {checkFutureBooking(servingRoom.id) && (
                  <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
                     <AlertCircle className="text-amber-600 mt-1" size={24} />
                     <div>
                        <p className="text-amber-800 font-black text-sm">تنبيه: الغرفة محجوزة</p>
                        <p className="text-amber-600 text-xs font-bold mt-1">يوجد حجز قادم في الساعة {formatTime(checkFutureBooking(servingRoom.id).start_time)} للعميل {checkFutureBooking(servingRoom.id).user_name || checkFutureBooking(servingRoom.id).customers?.full_name || 'حجز خارجي'}</p>
                     </div>
                  </div>
               )}

               <button 
                 onClick={handleStartServing}
                 disabled={processing}
                 className="w-full bg-indigo-600 text-white h-24 rounded-[2.5rem] font-black text-xl hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 disabled:opacity-50"
               >
                 {processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                 بدء الجلسة فوراً
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
