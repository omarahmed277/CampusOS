import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Timer, User, QrCode as QrIcon, CheckCircle2, Info, Key, UserPlus, ScanLine, Layout, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

// --- Helpers ---
const formatArabicTime = (date: Date) =>
  date.toLocaleTimeString('ar-EG', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'Africa/Cairo'
  });

const calculateRemaining = (target: Date, now: Date) => {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '0د';
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
};

const ROOM_COLORS: Record<string, string> = {
  blue: '#4f46e5',
  indigo: '#4f46e5',
  orange: '#f78c2a',
  red: '#f83854',
  green: '#1ed788',
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  slate: '#64748b',
  rose: '#f43f5e',
  pink: '#ec4899',
  cyan: '#06b6d4',
  teal: '#14b8a6',
};

const getHexColor = (color: string) => {
  if (!color) return '#4f46e5';
  const mapped = ROOM_COLORS[color.toLowerCase()];
  if (mapped) return mapped;
  return color.startsWith('#') ? color : '#4f46e5';
};

// --- Sub-components ---

interface ActiveRoomCardProps {
    session: any;
    isCompact: boolean;
    index: number;
}

const ActiveRoomCard: React.FC<ActiveRoomCardProps> = ({ session, isCompact, index }) => {
    const [now, setNow] = useState(new Date());
    const roomColor = getHexColor(session.services?.color);
    
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const startTime = new Date(session.start_time);
    const endTime = session.end_time ? new Date(session.end_time) : null;
    const remaining = endTime ? calculateRemaining(endTime, now) : 'نشط';
    
    let progress = 0;
    if (endTime) {
        const total = endTime.getTime() - startTime.getTime();
        const elapsed = now.getTime() - startTime.getTime();
        progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100, delay: index * 0.05 }}
            className={`relative flex flex-col justify-between rounded-[2.5rem] border shadow-2xl transition-all duration-500 group overflow-hidden ${isCompact ? 'p-5' : 'p-8'}`}
            style={{
                background: `linear-gradient(135deg, rgba(255, 255, 255, 0.04), ${roomColor}08)`,
                borderColor: `${roomColor}30`,
                backdropFilter: 'blur(40px)',
            }}
        >
            {/* Status Pulse */}
            <div className="absolute top-4 left-4">
                <div className="relative">
                    <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: roomColor, boxShadow: `0 0 15px ${roomColor}` }} />
                    <div className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-75" style={{ backgroundColor: roomColor }} />
                </div>
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                <div className="flex justify-between items-start">
                   <div className="text-right">
                       <h3 className={`${isCompact ? 'text-2xl' : 'text-4xl'} font-black text-white transition-colors leading-tight mb-2 truncate`}>
                           {session.services?.name_ar}
                       </h3>
                       <div className="flex items-center gap-2">
                           <span className="px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border"
                                 style={{ backgroundColor: `${roomColor}20`, color: roomColor, borderColor: `${roomColor}40` }}>
                               {session.services?.code}
                           </span>
                           {!isCompact && (
                             <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Occupied Session</span>
                           )}
                       </div>
                   </div>
                </div>

                {!isCompact && (
                    <div className="flex items-center justify-between bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">المستخدم الحالي</p>
                            <p className="text-xl font-black text-white truncate max-w-[200px]">
                                {session.user_name || session.customers?.full_name || 'عميل كلاسيك'}
                            </p>
                        </div>
                        <User className="text-white/10" size={32} />
                    </div>
                )}

                <div className={`grid ${isCompact ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                    {!isCompact && (
                        <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">وقت البدء</p>
                            <p className="text-lg font-bold text-white/80">{formatArabicTime(startTime)}</p>
                        </div>
                    )}
                    <div className="p-4 rounded-2xl border flex flex-col items-center justify-center" style={{ backgroundColor: `${roomColor}10`, borderColor: `${roomColor}20` }}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: `${roomColor}80` }}>متاحة الساعة</p>
                        <div className="flex items-center gap-2" style={{ color: roomColor }}>
                            <p className={`${isCompact ? 'text-xl' : 'text-2xl'} font-black leading-none`}>
                                {endTime ? formatArabicTime(endTime) : 'قريباً'}
                            </p>
                        </div>
                    </div>
                    <div className="p-4 rounded-2xl border flex flex-col items-center justify-center" style={{ backgroundColor: `${roomColor}05`, borderColor: `${roomColor}10` }}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: `${roomColor}60` }}>فاضية بعد</p>
                        <div className="flex items-center gap-2" style={{ color: roomColor }}>
                            <Timer size={isCompact ? 14 : 18} />
                            <p className={`${isCompact ? 'text-lg' : 'text-xl'} font-black`}>{remaining}</p>
                        </div>
                    </div>
                </div>

                {endTime && !isCompact && (
                    <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between text-[10px] font-black text-white/20 uppercase">
                            <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden p-0.5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full rounded-full"
                                style={{ background: roomColor, boxShadow: `0 0 20px ${roomColor}60` }}
                                transition={{ duration: 1 }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none opacity-20 transition-opacity group-hover:opacity-40 duration-700"
                 style={{ background: `radial-gradient(circle at top right, ${roomColor}30, transparent 70%)` }} />
        </motion.div>
    );
};

// --- Left Panel ---
const Sidebar = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const instructions = [
        { icon: <ScanLine className="text-indigo-400" size={18} />, title: "امسح الكود", desc: "ابدأ جلسة جديدة الآن" },
        { icon: <Key className="text-amber-400" size={18} />, title: "استعادة الكود", desc: "لو ناسي بياناتك سجل برقمك" },
        { icon: <UserPlus className="text-emerald-400" size={18} />, title: "حساب جديد", desc: "لو أول مرة سجل في لحظات" }
    ];

    return (
        <aside className="w-1/4 h-full bg-slate-900/40 backdrop-blur-3xl border-l border-white/5 p-12 flex flex-col items-center justify-between relative z-20 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
            
            <div className="w-full relative z-10">            
                <div className="text-center py-6 border-y border-white/10 mb-8 group">
                    <p className="text-5xl font-black text-white tracking-widest leading-none mb-2 font-mono group-hover:text-indigo-400 transition-colors uppercase">
                        {time.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit', 
                            hour12: true,
                            timeZone: 'Africa/Cairo'
                        }).toLowerCase().replace(' ', '')}
                    </p>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">
                        {time.toLocaleDateString('ar-EG', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long',
                            timeZone: 'Africa/Cairo'
                        })}
                    </p>
                </div>

                <div className="space-y-4">
                    {instructions.map((item, i) => (
                        <div key={i} className="flex flex-row-reverse items-center gap-5 p-5 bg-white/[0.03] rounded-[2rem] border border-white/5 hover:bg-white/5 transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shadow-inner">
                                {item.icon}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-white leading-none mb-1">{item.title}</p>
                                <p className="text-[10px] font-bold text-white/30">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full flex flex-col items-center gap-6 py-6 relative z-10">
                <div className="relative p-4 bg-white rounded-[2.5rem] shadow-[0_0_60px_rgba(79,70,229,0.2)] scale-100 flex flex-col items-center">
                    <div className="absolute -inset-4 bg-indigo-500/10 rounded-[3rem] blur-2xl animate-pulse" />
                    <div className="relative bg-white p-2 rounded-[1.5rem] border-[4px] border-slate-900 overflow-hidden mb-2">
                        <img src="/portal_qr.jpg" alt="Booking QR" className="w-[140px] h-[140px] object-contain rounded-lg" />
                    </div>
                    <div className="relative text-center pb-2">
                        <p className="text-sm font-black text-slate-900 tracking-tighter uppercase">Cloud Website</p>
                        <div className="h-0.5 w-8 bg-indigo-500 mx-auto rounded-full mt-1" />
                    </div>
                </div>
            </div>
            
            <div className="w-full text-center p-6 bg-white/[0.02] rounded-[2rem] border border-white/5">
                <div className="flex items-center gap-4 justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[9px] font-black text-rose-400">مشغول</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[9px] font-black text-indigo-400">متاح</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

// --- Main Display ---
export const PremiumDisplay = () => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActiveSessions = useCallback(async () => {
        const { data } = await supabase
            .from('workspace_sessions')
            .select('*, services(*), customers(full_name)')
            .eq('status', 'active')
            .not('service_id', 'is', null)
            .order('start_time', { ascending: false });

        if (data) {
            const roomSessions = data.filter((s: any) => 
                s.services?.service_type?.toLowerCase().includes('room')
            );
            setSessions(roomSessions);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchActiveSessions();
        const channel = supabase.channel('premium-display-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_sessions' }, fetchActiveSessions)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchActiveSessions]);

    // Enhanced Grid Logic for standard Room TVs
    const gridConfig = useMemo(() => {
        const count = sessions.length;
        if (count === 0) return { cols: 1, compact: false, gap: 8 };
        if (count === 1) return { cols: 1, compact: false, gap: 10 };
        if (count === 2) return { cols: 1, compact: false, gap: 10 };
        if (count === 3) return { cols: 2, compact: false, gap: 8 }; // 2 cols, one will span or just be centered
        if (count === 4) return { cols: 2, compact: false, gap: 8 };
        if (count <= 6) return { cols: 3, compact: false, gap: 6 };
        if (count <= 9) return { cols: 3, compact: true, gap: 4 };
        return { cols: 4, compact: true, gap: 3 };
    }, [sessions.length]);

    return (
        <div className="h-screen w-screen overflow-hidden bg-[#020617] flex font-['Cairo'] text-right relative" dir="rtl">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent_50%)]" />
                <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-indigo-500/5 rounded-full blur-[250px] animate-pulse" />
                <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] bg-rose-500/5 rounded-full blur-[200px]" />
            </div>

            <Sidebar />

            <main className="w-3/4 h-full p-12 flex flex-col relative z-10 overflow-hidden">
                <header className="mb-10 flex justify-between items-end border-r-8 border-indigo-500 pr-8">
                    <div>
                        <h1 className="text-6xl font-black text-white tracking-tighter mb-2">القاعات المشغولة حالياً</h1>
                        <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shadow-[0_0_15px_#f43f5e]" />
                            <p className="text-white/40 text-lg font-bold tracking-widest">متابعة حية لحالة الحجوزات النشطة</p>
                        </div>
                    </div>
                    {sessions.length > 0 && (
                        <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/5 text-slate-400 font-black text-xl">
                            {sessions.length} قاعات مشغولة
                        </div>
                    )}
                </header>
                
                <div className="flex-1 min-h-0 relative">
                    <AnimatePresence mode="popLayout">
                        {sessions.length > 0 ? (
                            <motion.div 
                                className="grid h-full w-full content-start"
                                style={{ 
                                    gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
                                    gap: `${gridConfig.gap * 6}px`
                                }}
                            >
                                {sessions.map((session, i) => (
                                    <ActiveRoomCard key={session.id} session={session} isCompact={gridConfig.compact} index={i} />
                                ))}
                            </motion.div>
                        ) : !loading && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center gap-10"
                            >
                                <div className="p-16 rounded-[4rem] bg-indigo-500/5 flex flex-col items-center gap-8 border border-white/5 relative">
                                    <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] rounded-full" />
                                    <Layout size={100} className="text-indigo-500/20 relative z-10" />
                                    <div className="space-y-4 relative z-10">
                                        <h2 className="text-5xl font-black text-white/30 tracking-tighter uppercase whitespace-nowrap">جميع القاعات متاحة حالياً</h2>
                                        <p className="text-white/20 text-xl font-bold">بادر بالحجز الآن من خلال مسح الكود الجانبي</p>
                                    </div>
                                    <div className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <footer className="mt-10 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.5em] text-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/30" />
                        <span>CAMPUS HUB OS // PREMIUM DISPLAY SYSTEM</span>
                    </div>
                    <span>© 2026 // ALL RIGHTS RESERVED</span>
                </footer>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default PremiumDisplay;
