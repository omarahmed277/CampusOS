
import React from 'react';
import { Zap, Sparkles, CreditCard, Clock, RefreshCw, MapPin, Users, Coffee, Award, LayoutGrid, CheckCircle2 } from 'lucide-react';

interface ProfileSectionProps {
  profileData: any;
  totalMinutes: number;
  userCompany: any;
  isUserLeader: boolean;
  userCompanyMembers: any[];
  companyContract: any;
  activeSub: any;
  isConverting: boolean;
  convertPointsToCashback: () => void;
  checkCompanyMembership: (id: string, phone: string) => void;
  setLeaderData: (data: any) => void;
  session: any;
  ptsPerHour: number;
  cbRatio: number;
}

export const ProfileSection = ({
  profileData,
  totalMinutes,
  userCompany,
  isUserLeader,
  userCompanyMembers,
  companyContract,
  activeSub,
  isConverting,
  convertPointsToCashback,
  checkCompanyMembership,
  setLeaderData,
  session,
  ptsPerHour,
  cbRatio
}: ProfileSectionProps) => {
  return (
    <div className="w-full max-w-lg mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20 font-['Cairo']">
       {/* Points & Cashback Dashboard */}
       <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4 overflow-visible">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-8 translate-x-8" />
             <Zap className="text-white opacity-20 absolute bottom-4 left-4 group-hover:scale-125 transition-transform" size={40} />
             <div className="absolute top-4 left-4 animate-bounce">
                <Sparkles className="text-amber-400 opacity-50" size={16} />
             </div>
             <p className="text-[9px] md:text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1 text-right">نقاط الولاء</p>
             <h3 className="text-2xl md:text-3xl font-black text-white text-right font-mono">{profileData?.loyalty_points || 0}</h3>
             <p className="text-[8px] md:text-[9px] font-bold text-indigo-300 text-right mt-1">{ptsPerHour} نقاط لكل ساعة</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-8 translate-x-8" />
             <CreditCard className="text-white opacity-20 absolute bottom-4 left-4 group-hover:scale-125 transition-transform" size={40} />
             <p className="text-[9px] md:text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1 text-right">رصيد الكاش باك</p>
             <h3 className="text-2xl md:text-3xl font-black text-white text-right font-mono">
                {Math.floor(profileData?.cashback_balance || 0)} 
                <span className="text-xs ml-1 opacity-50">EGP</span>
             </h3>
             <p className="text-[8px] md:text-[9px] font-bold text-emerald-300 text-right mt-1">رصيد متاح للاستخدام</p>
          </div>
          <div className="col-span-2 bg-gradient-to-br from-slate-700 to-slate-900 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-8 translate-x-8" />
             <Clock className="text-white opacity-20 absolute bottom-4 left-4 group-hover:scale-125 transition-transform" size={40} />
             <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">إجمالي الساعات</p>
             <h3 className="text-2xl md:text-3xl font-black text-white text-right font-mono">
                {(totalMinutes / 60).toFixed(0)} <span className="text-xs">H</span> {(totalMinutes % 60).toString().padStart(2, '0')} <span className="text-xs">M</span>
             </h3>
             <p className="text-[8px] md:text-[9px] font-bold text-slate-500 text-right mt-1">الوقت الإجمالي الذي قضيته في كلاود</p>
          </div>
       </div>

        {/* Company Section (Integration) */}
        {userCompany && (
           <div className="space-y-4">
              <div className="flex items-center justify-between px-2 text-right">
                 <div className="flex items-center gap-2 flex-row-reverse">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isUserLeader ? 'إدارة الشركة' : 'عضوية الشركة النشطة'}</p>
                 </div>
                 <button 
                   onClick={() => checkCompanyMembership(session.customer_id, session.phone_number)}
                   className="flex items-center gap-1.5 text-[9px] font-black text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md border border-indigo-500/20 transition-all active:scale-95 group"
                 >
                    <span>Live Sync</span>
                    <RefreshCw size={10} className="group-active:animate-spin" />
                 </button>
              </div>
              
              <div className={`bg-gradient-to-br ${isUserLeader ? 'from-indigo-600 to-indigo-900 border-indigo-400/30' : 'from-slate-800 to-slate-900 border-white/10 shadow-black/40'} border rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden group shadow-2xl transition-all hover:translate-y-[-2px]`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] -translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700" />
                  
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center md:items-start relative z-10 gap-6 text-center md:text-right">
                     <div className="flex-1 w-full overflow-hidden">
                        <div className="flex flex-row-reverse items-center justify-center md:justify-start gap-2 mb-2">
                           <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${isUserLeader ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-400'}`}>
                              {isUserLeader ? 'Team Leader' : 'Team Member'}
                           </span>
                           {!isUserLeader && (
                             <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">Verified</span>
                           )}
                        </div>
                        <h4 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2 truncate group-hover:whitespace-normal transition-all">{userCompany.name}</h4>
                        <div className="flex flex-wrap flex-row-reverse items-center justify-center md:justify-start gap-3 mt-1 opacity-60">
                           <p className="text-white text-xs font-bold font-mono tracking-wider italic uppercase">ID: {userCompany.company_code}</p>
                           <div className="h-1 w-1 bg-white/40 rounded-full" />
                           <p className="text-white text-[10px] font-black">{new Date(userCompany.created_at).getFullYear()} EST.</p>
                        </div>
                     </div>
                     
                     <div className={`w-20 h-20 rounded-[2.25rem] flex items-center justify-center text-white shadow-2xl transition-all group-hover:rotate-12 group-hover:scale-110 shrink-0 ${isUserLeader ? 'bg-white/20 backdrop-blur-xl ring-2 ring-white/20' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'}`}>
                        {isUserLeader ? <LayoutGrid size={36} /> : <Award size={36} />}
                     </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                     <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 text-right">فريقك</p>
                        <div className="flex flex-row-reverse items-center gap-2">
                           <Users size={14} className="text-indigo-400" />
                           <span className="text-lg font-black text-white">{userCompanyMembers.length} <span className="text-[10px] opacity-40">أعضاء</span></span>
                        </div>
                     </div>
                     
                     <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 text-right">رصيد بوفيه مشترك</p>
                        <div className="flex flex-row-reverse items-center gap-2">
                           <Coffee size={14} className="text-emerald-400" />
                           <span className="text-lg font-black text-white">{companyContract?.catering_prepaid_total || 0} <span className="text-[10px] opacity-40 uppercase">egp</span></span>
                        </div>
                     </div>
                  </div>

                  {isUserLeader ? (
                     <div className="mt-6">
                        <button 
                          onClick={() => {
                              setLeaderData({ company: userCompany, contract: companyContract, members: userCompanyMembers });
                          }}
                          className="w-full h-16 bg-white hover:bg-indigo-50 text-indigo-900 rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-950/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                           <span>فتح لوحة إدارة الشركة</span>
                           <LayoutGrid size={18} />
                        </button>
                     </div>
                  ) : (
                    <div className="mt-6 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-row-reverse items-center justify-between gap-4">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Corporate Member info</p>
                          <p className="text-xs font-bold text-white/80">تكاليف الجلسة مدفوعة بالكامل بواسطة الشركة</p>
                       </div>
                       <Award className="text-amber-400 shrink-0" size={20} />
                    </div>
                  )}
              </div>
           </div>
        )}

       {/* Points Conversion Card */}
       {profileData?.loyalty_points >= 10 && (
         <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex items-center justify-between gap-4 backdrop-blur-xl group hover:border-indigo-500/50 transition-all">
            <div className="text-right">
               <h4 className="font-black text-white text-sm">حول نقاطك إلى نقود</h4>
               <p className="text-[10px] font-bold text-slate-500">كل 100 نقطة = {(100 / cbRatio).toFixed(2)} جنيه كاش باك</p>
            </div>
            <button 
               onClick={convertPointsToCashback}
               disabled={isConverting}
               className="h-12 px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-50"
            >
               {isConverting ? <RefreshCw className="animate-spin" /> : 'تحويل الآن ✨'}
            </button>
         </div>
       )}

       {/* Subscription Section */}
       <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-right flex-row-reverse">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إدارة الاشتراك</p>
             <Sparkles size={14} className="text-amber-400" />
          </div>
          
          {activeSub ? (
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden group font-['Cairo']">
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
               <div className="flex flex-row-reverse justify-between items-center group-hover:px-2 transition-all">
                  <div className="text-right">
                     <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter mb-2 inline-block">Active Plan</span>
                     <h4 className="text-2xl font-black text-white">{activeSub.type}</h4>
                     <p className="text-slate-500 text-xs font-bold mt-1 tracking-wide">ينتهي في: {new Date(activeSub.end_date).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-white ring-1 ring-white/10 group-hover:rotate-12 transition-transform">
                     <Clock size={32} />
                  </div>
               </div>
               
               <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex flex-row-reverse justify-between text-xs font-black">
                     <span className="text-slate-400 uppercase tracking-widest">المتبقي من الساعات</span>
                     <span className="text-white">{(activeSub.total_hours - activeSub.used_hours).toFixed(1)} / {activeSub.total_hours}H</span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(30,215,136,0.3)] transition-all duration-1000" 
                        style={{ width: `${Math.min(100, Math.max(0, ((activeSub.total_hours - activeSub.used_hours) / activeSub.total_hours) * 100))}%` }}
                      />
                  </div>
               </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-[2.5rem] p-10 text-center space-y-4">
               <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-700">
                  <Clock size={32} />
               </div>
               <div className="space-y-1">
                  <p className="text-white font-black">لا يوجد اشتراك نشط</p>
                  <p className="text-slate-500 text-xs font-bold">يمكنك الاشتراك من مكتب الاستقبال للاستفادة بأسعار أقل</p>
               </div>
            </div>
          )}
       </div>
    </div>
  );
};
