import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, User, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';

// --- Hooks & Helpers ---
const useLiveTime = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
};

const formatArabicTime = (date: Date) =>
  date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

const minutesToTime = (minutes: number) => {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

const calculateRemaining = (target: Date, now: Date) => {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '0د';
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
};

const ROOM_COLORS: Record<string, string> = {
  blue: '#1E75B9',
  orange: '#F78C2A',
  red: '#F83854',
  green: '#1ED788',
  amber: '#F59E0B',
  emerald: '#10B981',
  sky: '#0EA5E9',
  violet: '#8B5CF6',
  slate: '#64748B',
  indigo: '#4F46E5',
};

const getHexColor = (color: string) => {
  const mapped = ROOM_COLORS[color?.toLowerCase()];
  if (mapped) return mapped;
  return color?.startsWith('#') ? color : '#6366f1';
};

// --- Room Card ---
const RoomCard = ({ room, sessions, bookings, index }: any) => {
  const time = useLiveTime();
  const currentSession = sessions.find((s: any) => s.service_id === room.id && s.status !== 'completed');
  const isOccupied = !!currentSession;
  const isEnding = currentSession?.status === 'checkout_requested';
  const today = time.toISOString().split('T')[0];
  const nowMinutes = time.getHours() * 60 + time.getMinutes();

  const nextBooking = bookings
    .filter((b: any) => b.service_id === room.id && b.booking_date === today && b.start_time > nowMinutes && b.status !== 'Cancelled')
    .sort((a: any, b: any) => a.start_time - b.start_time)[0];

  const isReservedSoon = !isOccupied && nextBooking && nextBooking.start_time - nowMinutes <= 30;
  const status = isOccupied ? 'occupied' : isReservedSoon ? 'soon' : 'available';

  const getFreeUntil = () => {
    if (isOccupied && currentSession?.end_time) return new Date(currentSession.end_time);
    if (nextBooking) return minutesToTime(nextBooking.start_time);
    return null;
  };
  const freeUntil = getFreeUntil();

  const getSessionRemaining = () => {
    if (!currentSession?.end_time) return 'نشط';
    return calculateRemaining(new Date(currentSession.end_time), time);
  };

  const statusLabel = isEnding ? 'جاري المغادرة...' : (status === 'occupied' ? 'مشغول' : status === 'soon' ? 'محجوز قريباً' : 'متاح حالياً');
  const statusIcon = isEnding ? <Timer className="animate-pulse" size={18} /> : (status === 'occupied' ? <User size={18} /> : status === 'soon' ? <Calendar size={18} /> : <Clock size={18} />);
  
  // High-Contrast Status Colors
  const statusColor = isEnding ? '#3B82F6' : (status === 'occupied' ? '#F83854' : (status === 'soon' ? '#F78C2A' : '#1ED788'));
  const roomColor = getHexColor(room.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl"
      style={{
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: `${roomColor}80`,
        background: `linear-gradient(135deg, rgba(15, 23, 42, 0.4), ${roomColor}08)`,
        backdropFilter: 'blur(50px)',
      }}
    >
      {/* Dynamic Room-ID Glow Background */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{ background: `radial-gradient(circle at top, ${roomColor}${status === 'occupied' ? '25' : '10'}, transparent 70%)` }}
      />

      <div className="relative z-10 p-8 flex flex-col h-full gap-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="text-right flex-1">
            <h2 className="text-4xl font-black tracking-tight leading-tight" style={{ color: roomColor }}>{room.name_ar}</h2>
            <div
              className="mt-3 inline-flex items-center gap-2 px-5 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em]"
              style={{ background: `${roomColor}15`, color: `${roomColor}cc`, border: `1px solid ${roomColor}25` }}
            >
              {room.code}
            </div>
          </div>
          <div className="text-right">
             <div className={`w-3 h-3 rounded-full animate-ping`} style={{ backgroundColor: statusColor }} />
          </div>
        </div>

        {/* Status Badge - PURE COLOR SIGN */}
        <div className="flex justify-center">
          <motion.div
            key={status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-4 px-10 py-5 rounded-full text-2xl font-black shadow-2xl transition-all duration-500"
            style={{
              background: statusColor,
              color: 'white',
              boxShadow: `0 0 50px ${statusColor}40`,
            }}
          >
            {statusIcon}
            {statusLabel}
            <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
          </motion.div>
        </div>

        {/* Main Info Area */}
        <div
          className={`flex-1 flex flex-col items-center justify-center rounded-[2.5rem] p-8 gap-6 transition-all duration-1000 ${isOccupied ? 'bg-white/[0.03]' : ''}`}
          style={{ border: `1px solid ${roomColor}15` }}
        >
          {isOccupied ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl" style={{ background: `${roomColor}25`, border: `2px solid ${roomColor}40` }}>
                <User size={36} style={{ color: roomColor }} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">المستخدم الحالي</p>
                <p className="text-3xl font-black text-white">
                  {currentSession.user_name || currentSession.customers?.full_name || 'عميل'}
                </p>
              </div>
              <div className="flex items-center gap-3 px-8 py-3 rounded-2xl text-lg font-black" style={{ background: `${roomColor}20`, color: roomColor, border: `1px solid ${roomColor}30` }}>
                <Timer size={20} />
                <span>متبقي: {getSessionRemaining()}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-black tracking-widest text-white/40 uppercase">جاهز للاستقبال</p>
            </>
          )}

          <div className="w-full pt-6 mt-2 text-center" style={{ borderTop: `1px solid ${roomColor}20` }}>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] mb-2 text-white/30">
              {isOccupied ? 'ينتهي في' : 'متاح حتى'}
            </p>
            <p className="text-3xl font-black text-white tracking-tight">
              {freeUntil ? formatArabicTime(freeUntil) : 'طوال اليوم'}
            </p>
          </div>
        </div>

        {/* Booking Footer */}
        <div className="flex items-center justify-between p-6 rounded-[2rem]" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${roomColor}10` }}>
          <div className="flex items-center gap-5 text-right">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `${roomColor}15` }}>
              <Calendar size={28} style={{ color: roomColor }} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-1">الحجز التالي</p>
              <p className="text-xl font-black text-white/80">
                {nextBooking?.user_name || nextBooking?.customers?.full_name || (nextBooking ? 'حجز مسجل' : 'لا يوجد')}
              </p>
            </div>
          </div>
          {nextBooking && (
            <p className="text-2xl font-black font-mono text-white/50">
              {formatArabicTime(minutesToTime(nextBooking.start_time))}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- Main Dashboard ---
export const RoomsKiosk = () => {
  const time = useLiveTime();
  const [rooms, setRooms] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async (bId: string) => {
    if (!bId) return;
    setSyncing(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: rs } = await (supabase.from('services').select('*') as any).eq('branch_id', bId).ilike('service_type', 'room').eq('is_active', true);
      const { data: ss } = await (supabase.from('workspace_sessions').select('*, customers(full_name)') as any).eq('branch_id', bId).neq('status', 'completed');
      const { data: bs } = await (supabase.from('bookings').select('*, customers(full_name)') as any).eq('branch_id', bId).eq('booking_date', today);

      if (rs) setRooms(rs.sort((a: any, b: any) => a.code.localeCompare(b.code)));
      if (ss) setSessions(ss);
      if (bs) setBookings(bs);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setTimeout(() => setSyncing(false), 1000);
    }
  }, []);

  useEffect(() => {
    let activeBranchId: string | null = null;
    let channel: any = null;

    const setup = async () => {
      const { data: branches } = await supabase.from('branches').select('*').eq('is_active', true);
      activeBranchId = branches?.find(b => b.name.toLowerCase().includes('cloud'))?.id || branches?.[0]?.id;
      if (!activeBranchId) return;

      await fetchData(activeBranchId);

      // --- Enhanced Real-time Subscription ---
      channel = supabase.channel(`kiosk-realtime-${activeBranchId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_sessions' }, () => activeBranchId && fetchData(activeBranchId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => activeBranchId && fetchData(activeBranchId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => activeBranchId && fetchData(activeBranchId))
        .subscribe();

      const interval = setInterval(() => activeBranchId && fetchData(activeBranchId), 60000);
      return () => clearInterval(interval);
    };

    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetchData]);

  return (
    <div className="h-screen w-screen p-10 overflow-hidden flex flex-col relative bg-[#020617] text-right" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full blur-[200px] opacity-10 bg-indigo-500" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[800px] h-[800px] rounded-full blur-[200px] opacity-10 bg-emerald-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[250px] opacity-5 bg-blue-500" />
      </div>

      {/* Glass Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-10 relative z-20"
      >
        <div className="flex items-center gap-5">
           <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${syncing ? 'border-amber-500/30' : 'border-emerald-500/30'} bg-white/[0.02] backdrop-blur-xl`}>
             <div className={`w-3 h-3 rounded-full ${syncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_15px_#10b981]'}`} />
             <span className={`text-xs font-black uppercase tracking-[0.4em] ${syncing ? 'text-amber-500' : 'text-emerald-500'}`}>
               {syncing ? 'جارِ المزامنة...' : 'بث مباشر متصل'}
             </span>
           </div>
        </div>
        
        <div className="text-right">
          <p className="text-5xl font-black text-white tracking-widest mb-1 font-mono uppercase">{formatArabicTime(time)}</p>
          <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/30">
            {time.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </motion.header>

      {/* High-Performance Flexible Grid (Prioritizes Columns) */}
      <div className="flex-1 flex flex-row gap-6 relative z-10 min-h-0 overflow-hidden">
        {rooms.map((room, i) => (
          <div key={room.id} className="flex-1 min-w-[320px] h-full">
            <RoomCard room={room} sessions={sessions} bookings={bookings} index={i} />
          </div>
        ))}
      </div>

      {/* Futuristic Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-10 flex justify-between items-center text-[11px] font-black uppercase tracking-[0.5em] relative z-20 px-4 text-white/20"
      >
        <span>Campus OS // Future Signage System</span>
        <div className="flex items-center gap-6">
           <span>v12.4.0</span>
           <div className="w-px h-4 bg-white/10" />
           <span className="text-white/40">Powered by Antigravity AI</span>
        </div>
      </motion.footer>
    </div>
  );
};

export default RoomsKiosk;