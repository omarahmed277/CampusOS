
import React from 'react';
import { User, Phone, Mail, Lock, Zap, ArrowRight, RefreshCw, ChevronLeft, LayoutGrid, Info, Wind, Sparkles } from 'lucide-react';

interface LandingFormsProps {
  isForgotCode: boolean;
  isLeaderPortal: boolean;
  isSignUp: boolean;
  setIsSignUp: (val: boolean) => void;
  setIsForgotCode: (val: boolean) => void;
  setIsLeaderPortal: (val: boolean) => void;
  setError: (val: string) => void;
  error: string;
  loading: boolean;
  handleForgotCode: (e: React.FormEvent) => void;
  handleSignUp: (e: React.FormEvent) => void;
  handleLogin: (e: React.FormEvent) => void;
  handleLeaderLogin: (e: React.FormEvent) => void;
  forgotEmail: string;
  setForgotEmail: (val: string) => void;
  fullName: string;
  setFullName: (val: string) => void;
  phoneNumber: string;
  setPhoneNumber: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  userCode: string;
  setUserCode: (val: string) => void;
  leaderCode: string;
  setLeaderCode: (val: string) => void;
}

export const LandingForms = ({
  isForgotCode,
  isLeaderPortal,
  isSignUp,
  setIsSignUp,
  setIsForgotCode,
  setIsLeaderPortal,
  setError,
  error,
  loading,
  handleForgotCode,
  handleSignUp,
  handleLogin,
  handleLeaderLogin,
  forgotEmail,
  setForgotEmail,
  fullName,
  setFullName,
  phoneNumber,
  setPhoneNumber,
  email,
  setEmail,
  userCode,
  setUserCode,
  leaderCode,
  setLeaderCode
}: LandingFormsProps) => {
  return (
    <div className="bg-[#0B0F19]/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-8 md:p-12 w-full max-w-md relative z-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 fade-in duration-1000 ring-1 ring-white/10">
      <div className="text-center mb-8 group">
        <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-3xl mx-auto flex items-center justify-center mb-4 border border-white/10 shadow-2xl p-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
           <img src="/logo.png" alt="Cloud Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Cloud Co-Working</h1>
        <div className="h-1 w-10 bg-indigo-500 mx-auto rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
      </div>

      {/* Auth Tabs */}
      {!isForgotCode && !isLeaderPortal && (
        <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/10 mb-8 relative">
          <div 
            className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-indigo-600 rounded-xl transition-all duration-500 ease-in-out shadow-lg shadow-indigo-600/30"
            style={{ 
              left: isSignUp ? '6px' : 'calc(50% + 3px)',
              right: isSignUp ? 'calc(50% + 3px)' : '6px'
            }}
          />
          <button
            onClick={() => { setIsSignUp(false); setError(''); }}
            className={`relative z-10 flex-1 py-3 text-sm font-black transition-colors duration-300 ${!isSignUp ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(''); }}
            className={`relative z-10 flex-1 py-3 text-sm font-black transition-colors duration-300 ${isSignUp ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            إنشاء حساب
          </button>
        </div>
      )}

      {isForgotCode && (
         <div className="text-center mb-8">
           <p className="text-slate-400 font-bold text-sm tracking-wide text-right">استعادة كود الدخول</p>
         </div>
      )}

      {isForgotCode ? (
        <form onSubmit={handleForgotCode} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
           {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">البريد الإلكتروني أو رقم الهاتف</label>
            <div className="relative group">
              <input
                type="text"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold focus:outline-none focus:border-[#f78c2a] focus:ring-4 focus:ring-[#f78c2a]/10 transition-all placeholder:text-slate-600"
                placeholder="01xxxxxxxxx أو example@mail.com"
                dir="auto"
              />
            </div>
            <div className="flex items-start gap-2 bg-[#f78c2a]/10 p-4 rounded-2xl border border-[#f78c2a]/20 mt-4 flex-row-reverse">
               <Info size={16} className="text-[#f78c2a] shrink-0 mt-0.5" />
               <p className="text-[10px] text-slate-300 font-bold leading-relaxed text-right">
                 تنبيه: سيتم إرسال الكود فوراً إلى بريدك الإلكتروني المسجل لدينا لتتمكن من الدخول.
               </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading || !forgotEmail}
              className="w-full h-16 bg-[#f78c2a] hover:bg-[#e67b1a] disabled:opacity-50 text-white rounded-2xl font-black text-lg transition-all shadow-[0_20px_40px_rgba(247,140,42,0.2)] active:scale-95 flex items-center justify-center gap-3"
            >
              {loading ? <RefreshCw className="animate-spin" /> : (
                <>
                  <span>إرسال الكود للبريد</span>
                  <Zap size={20} />
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => { setIsForgotCode(false); setError(''); }}
              className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft size={14} /> العودة لتسجيل الدخول
            </button>
          </div>
        </form>
      ) : isSignUp ? (
        <form onSubmit={handleSignUp} className="space-y-5 animate-in slide-in-from-left-4 duration-500">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase">
              {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">الاسم بالكامل</label>
            <div className="relative group">
              <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700 text-right"
                placeholder="أحمد محمد"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">رقم الهاتف</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                 className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                placeholder="example@mail.com"
                dir="ltr"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || !fullName || !phoneNumber}
              className="w-full bg-[#1ed788] hover:bg-[#1bbd77] disabled:opacity-50 text-[#0B0F19] rounded-2xl py-5 font-black text-xl transition-all shadow-[0_20px_40px_rgba(30,215,136,0.2)] active:scale-95 flex items-center justify-center gap-3 group"
            >
              {loading ? <RefreshCw className="animate-spin" size={24} /> : (
                <>
                  <span>إنشاء الحساب ومتابعة</span>
                  <ArrowRight size={24} className="group-hover:translate-x-[-4px] transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      ) : isLeaderPortal ? (
         <form onSubmit={handleLeaderLogin} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
           {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase text-center">
              {error}
            </div>
          )}
          <div className="space-y-4">
             <div className="p-6 bg-indigo-500/10 rounded-3xl border border-indigo-500/20">
                <h3 className="text-white font-black text-xl mb-2 text-center underline decoration-indigo-500 underline-offset-8">بوابة مسؤولي الشركات</h3>
                <p className="text-slate-400 text-xs font-bold leading-relaxed text-center">أدخل كود الشركة لمتابعة استهلاك فريقك وميزانية الشهر الحالية.</p>
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">كود الشركة</label>
                <div className="relative group">
                  <LayoutGrid size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
                  <input
                    type="text"
                    required
                    value={leaderCode}
                    onChange={(e) => setLeaderCode(e.target.value)}
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-black text-center focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700 uppercase tracking-[0.3em]"
                    placeholder="EX: VOD-2026"
                  />
                </div>
             </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading || !leaderCode}
              className="w-full h-18 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-3xl font-black text-xl transition-all shadow-[0_20px_40px_rgba(79,70,229,0.3)] active:scale-95 flex items-center justify-center gap-3"
            >
              {loading ? <RefreshCw className="animate-spin" /> : (
                <>
                  <span>دخول لمساحة الشركة</span>
                  <Sparkles size={22} />
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => setIsLeaderPortal(false)}
              className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft size={14} /> العودة لدخول الأفراد
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
           {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase">
              {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">كود المستخدم</label>
            <div className="relative group">
              <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
              <input
                type="text"
                required
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700 uppercase tracking-[0.2em]"
                placeholder="C0001"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1 text-right">رقم الهاتف</label>
            <div className="relative group">
              <Wind size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400 rotate-90" />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-8 text-center border-t border-white/5 pt-6">
            <button
              type="button"
              onClick={() => { setIsForgotCode(true); setIsSignUp(false); setError(''); }}
              className="flex-1 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
            >
              نسيت الكود؟ <span className="text-[#f78c2a] underline ml-1">استعادة</span>
            </button>
            <div className="w-px h-4 bg-white/5" />
            <button
              type="button"
              onClick={() => { setIsLeaderPortal(true); setError(''); }}
              className="flex-1 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
            >
              <LayoutGrid size={12} className="text-indigo-400" /> مسؤول شركة؟ <span className="text-indigo-500 underline ml-1">دخول</span>
            </button>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || !userCode || !phoneNumber}
              className="w-full h-16 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xl transition-all shadow-[0_20px_40px_rgba(79,70,229,0.2)] active:scale-95 group"
            >
              {loading ? <RefreshCw className="animate-spin" /> : (
                <>
                  <span>بدء الجلسة الآن</span>
                  <ArrowRight size={22} className="group-hover:translate-x-[-4px] transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
