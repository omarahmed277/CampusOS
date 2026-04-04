
import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Modal } from '../ui';

interface RegistrationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  regSuccessData: { name: string; code: string; email?: string } | null;
  onAction: (code: string) => void;
}

export const RegistrationSuccessModal = ({
  isOpen,
  onClose,
  regSuccessData,
  onAction
}: RegistrationSuccessModalProps) => {
  if (!regSuccessData) return null;

  return (
    <Modal
      isOpen={isOpen && !!regSuccessData}
      onClose={onClose}
      className="max-w-md md:max-w-lg p-0 overflow-visible bg-transparent border-none shadow-none"
    >
      <div className="bg-[#0B0F19] rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 text-center space-y-6 md:space-y-10 border border-white/10 relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-500/15 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-3xl flex items-center justify-center mx-auto text-[#1ed788] animate-bounce shadow-[0_0_50px_rgba(30,215,136,0.1)] border border-emerald-500/20">
           <CheckCircle2 size={40} />
        </div>

        <div className="relative z-10 space-y-4">
           <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-tight">مرحباً بك في كلاود! ✨</h2>
           <p className="text-slate-400 font-bold text-sm md:text-lg px-4 md:px-8 leading-relaxed">
             أهلاً بك <span className="text-emerald-400 font-black">{regSuccessData.name}</span>. تم تأكيد حسابك بنجاح وجاهز لبدء أول جلسة عمل لك.
           </p>
        </div>

        <div className="relative z-10 group p-6 md:p-10 bg-white/[0.03] backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-inner translate-y-2">
           <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none" />
           <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                 <div className="h-px w-8 bg-indigo-500/30" />
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] whitespace-nowrap">Your Access ID</p>
                 <div className="h-px w-8 bg-indigo-500/30" />
              </div>
              
              <div className="bg-black/30 py-6 md:py-10 px-4 rounded-[1.5rem] md:rounded-[2rem] border-2 border-dashed border-indigo-500/20 relative group-hover:border-indigo-500/40 transition-colors">
                 <span className="text-5xl md:text-7xl font-black text-white font-mono tracking-[0.15em]">
                   {regSuccessData.code}
                 </span>
              </div>
           </div>
        </div>

        <div className="relative z-10 pt-4">
          <button
            onClick={() => onAction(regSuccessData.code)}
            className="w-full h-16 md:h-20 bg-white hover:bg-emerald-400 text-[#0B0F19] rounded-[1.5rem] md:rounded-[2rem] font-black text-lg md:text-2xl transition-all shadow-[0_20px_60px_rgba(0,0,0,0.3)] active:scale-95 group flex items-center justify-center gap-3 overflow-hidden relative"
          >
            <span>تسجيل الدخول وبدء العمل</span>
            <ArrowRight size={24} className="group-hover:translate-x-[-8px] transition-transform" />
          </button>
        </div>
      </div>
    </Modal>
  );
};
