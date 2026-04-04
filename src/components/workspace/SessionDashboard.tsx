import React from 'react';
import { Modal, Button } from '../ui';
import { Sparkles, Clock, RefreshCw, LogOut, Plus, HelpCircle } from 'lucide-react';

interface SessionDashboardProps {
  session: any;
  elapsedTime: string;
  setShowCheckoutConfirm: (val: boolean) => void;
  handleRequestPause: (status: string) => void;
  handleResumeSession: () => void;
  ptsPerHour: number;
  cbRatio: number;
  showCheckoutConfirm: boolean;
  handleCheckoutRequest: () => void;
}

export const SessionDashboard = ({
  session,
  elapsedTime,
  setShowCheckoutConfirm,
  handleRequestPause,
  handleResumeSession,
  ptsPerHour,
  cbRatio,
  showCheckoutConfirm,
  handleCheckoutRequest
}: SessionDashboardProps) => {
  return (
    <div className="w-full max-w-lg mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 font-['Cairo'] text-right">
      
      {/* Modern Welcome Card */}
      <div className="relative group mt-2">
         <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 rounded-[2.5rem] blur-2xl" />
         <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col items-center group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl translate-y-12 -translate-x-12" />
            
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[2rem] flex items-center justify-center text-white shadow-2xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
               <Sparkles size={40} className="animate-pulse" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-black text-white text-center leading-tight">
               أهلاً بيك في كلاود ☁️ <br/> 
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">بدأت السيشن بتاعتك بنجاح</span>
            </h2>
            <p className="text-slate-400 font-bold text-center mt-3 text-sm md:text-base opacity-70">نتمني لك يوم سعيد ومليء بالانتاجية</p>
         </div>
      </div>

      {/* Futuristic Modern Timer */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-b from-white/10 to-transparent rounded-[3rem] blur-sm" />
        <div className="bg-slate-900/60 backdrop-blur-2xl border-x border-t border-white/10 rounded-[3rem] p-10 md:p-12 w-full relative shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-indigo-500/20 blur-[60px] rounded-full" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.1),transparent)] pointer-events-none" />
          
          <div className="flex flex-col items-center relative z-10">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
               <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.5em] opacity-80">Active Time Tracking</span>
               <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
            </div>

            <div className="relative">
               <div className="absolute inset-0 bg-indigo-400/5 blur-3xl rounded-full scale-150" />
               <div className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white font-mono tracking-tighter tabular-nums flex items-baseline filter drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] leading-none">
                  {elapsedTime}
               </div>
            </div>

            <div className="flex items-center gap-8 mt-10 w-full pt-8 border-t border-white/5">
               <div className="flex-1 text-center border-r border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Start Time</p>
                  <p className="text-sm font-black text-white">{new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
               </div>
               <div className="flex-1 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Session Status</p>
                  <div className="flex items-center justify-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-sm font-black text-emerald-500">Live Session</span>
                  </div>
               </div>
            </div>
          </div>

          {session.status === 'checkout_requested' && (
            <div className="mt-8 relative animate-in zoom-in-95 duration-500">
               <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-2xl" />
               <div className="relative bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold p-5 rounded-2xl shadow-2xl backdrop-blur-md text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                     <RefreshCw className="animate-spin" size={20} />
                     <span className="text-lg font-black uppercase tracking-tight">إنتظار التأكيد</span>
                  </div>
                  <p className="text-sm leading-relaxed opacity-80">يرجى التوجه لمكتب الاستقبال لسداد الحساب وإتمام المغادرة</p>
               </div>
            </div>
          )}
        </div>
      </div>
      
      {/* PRIMARY ACTION BUTTONS */}
      <div className="flex flex-col gap-4">
          {session.status === 'active' && (
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => setShowCheckoutConfirm(true)}
                    className="h-20 bg-rose-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-rose-900/20 active:scale-95 transition-all group"
                >
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                        <LogOut size={22} />
                    </div>
                    إنهاء الجلسة
                </button>
                
                <button
                    onClick={() => handleRequestPause('pause_requested')}
                    className="h-20 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-amber-500/20 active:scale-95 transition-all group"
                >
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:-rotate-12 transition-transform">
                        <Clock size={22} />
                    </div>
                    إيقاف العداد
                </button>
            </div>
          )}

          {session.status === 'pause_requested' && (
            <div className="h-24 bg-amber-500/10 border border-amber-500/30 rounded-[2.5rem] p-6 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                        <Clock size={24} className="animate-spin" />
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-black text-amber-500">جاري طلب الإيقاف المؤقت...</p>
                        <p className="text-xs font-bold text-slate-500">في انتظار موافقة المسؤول</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleRequestPause('active')}
                    className="text-xs font-black text-slate-400 underline underline-offset-4 hover:text-slate-200 decoration-slate-600"
                >
                    إلغاء الطلب
                </button>
            </div>
          )}

          {session.status === 'paused' && (
            <button
                onClick={handleResumeSession}
                className="h-24 w-full bg-emerald-500 text-white rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl shadow-emerald-900/30 animate-in zoom-in-95 duration-500 hover:bg-emerald-400 group"
            >
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={28} />
                </div>
                استكمال السيشن ▶️
            </button>
          )}

          {session.status === 'checkout_requested' && (
            <div className="h-24 bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex items-center justify-center gap-4 text-slate-400 animate-pulse">
                <RefreshCw size={24} className="animate-spin" />
                <span className="font-black text-lg">جاري مراجعة طلبك..</span>
            </div>
          )}
      </div>

      {/* Step-by-step confirmation for Checkout */}
      {showCheckoutConfirm && (
        <Modal
          isOpen={showCheckoutConfirm}
          onClose={() => setShowCheckoutConfirm(false)}
          title="تأكيد إنهاء الجلسة"
          className="max-w-sm text-center"
        >
          <div className="relative space-y-8 pb-4">
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-500/5 animate-pulse mb-4 mt-4">
              <HelpCircle size={48} className="text-rose-500" />
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-black text-white leading-tight">
                هل أنت متأكد من إنهاء الجلسة؟
              </h3>
              <p className="text-slate-400 text-sm font-bold leading-relaxed px-4">
                سيتم حساب الوقت الإجمالي وطلب إنهاء الجلسة من الـ Admin. لا يمكنك طلب خدمات إضافية بعد هذا الإجراء.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  setShowCheckoutConfirm(false);
                  handleCheckoutRequest();
                }}
                className="w-full h-16 bg-rose-600 text-white rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl shadow-rose-900/20 hover:bg-rose-500"
              >
                نعم، إنهاء الجلسة
              </Button>
              <Button
                onClick={() => setShowCheckoutConfirm(false)}
                className="w-full h-14 bg-white/5 text-slate-300 border border-white/10 rounded-2xl font-black text-md transition-all active:scale-95 hover:bg-white/10"
              >
                تراجع، ابقى هنا
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
