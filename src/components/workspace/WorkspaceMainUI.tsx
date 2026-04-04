
import React from 'react';
import { 
  User, Award, Zap, Wind, Lock, Coffee, Clock, ShoppingBag, Info, HelpCircle, RefreshCw 
} from 'lucide-react';
import { SessionDashboard } from './SessionDashboard';
import { CateringStore } from './CateringStore';
import { ProfileSection } from './ProfileSection';

export const WorkspaceMainUI = ({
  session,
  userCompany,
  activeTab,
  setActiveTab,
  elapsedTime,
  cateringItems,
  cart,
  storeSearch,
  setStoreSearch,
  storeCategory,
  setStoreCategory,
  viewMode,
  setViewMode,
  addToCart,
  removeFromCart,
  handleCheckoutCart,
  orderLoading,
  profileData,
  totalMinutes,
  isUserLeader,
  userCompanyMembers,
  companyContract,
  activeSub,
  isConverting,
  convertPointsToCashback,
  checkCompanyMembership,
  setLeaderData,
  ptsPerHour,
  cbRatio,
  showCheckoutConfirm,
  setShowCheckoutConfirm,
  handleRequestPause,
  handleResumeSession,
  handleCheckoutRequest,
  fetchStoreItems
}: any) => {
  return (
    <div className="h-[100dvh] bg-[#0B0F19] flex flex-col font-['Cairo'] text-right relative overflow-hidden">
      {/* Abstract Branding Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1e75b9]/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#1ed788]/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-[#f78c2a]/5 rounded-full blur-[150px] pointer-events-none rotate-45" />

      {/* TOP PROFILE HEADER */}
      <div className="relative z-10 pt-8 pb-4 px-6 bg-[#0B0F19]/60 backdrop-blur-3xl border-b border-white/10 flex items-center justify-between animate-in slide-in-from-top-8 duration-700 shadow-2xl shrink-0">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {/* Animated Cyber Ring */}
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-500 opacity-20 group-hover:opacity-100 blur-sm animate-[spin_8s_linear_infinite] transition-opacity" />
            <div className="absolute -inset-1 rounded-full bg-[#0B0F19] z-10" />
            
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 relative z-20 flex items-center justify-center shadow-2xl overflow-hidden hover:scale-105 transition-transform duration-500">
              <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
              <User size={24} className="text-indigo-400 relative z-10" />
            </div>
          </div>
          
          <div className="text-right">
            {userCompany ? (
              <div className="flex items-center gap-1.5 mb-1 justify-end group cursor-help" title="Corporate Plan Active">
                <Award size={10} className="text-amber-400 group-hover:scale-125 transition-transform" />
                <p className="text-indigo-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] opacity-80 border-b border-indigo-500/20 pb-0.5">Business Member</p>
              </div>
            ) : (
              <p className="text-emerald-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.25em] mb-1 opacity-70">Cloud Member</p>
            )}
            
            <h1 className="text-xl md:text-3xl font-black text-white leading-tight flex items-center gap-2 justify-end">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                {session.customers?.full_name?.split(' ')[0] || 'المستخدم'}
              </span>
              <span className="text-slate-500 font-bold opacity-30 text-sm md:text-base pr-1">،أهلاً</span>
            </h1>
            <div className="flex items-center justify-end gap-2 mt-1.5">
               <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse mr-0.5" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{session.user_code}</span>
               </div>
               {userCompany && (
                 <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">Corp</span>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-6 relative z-10 custom-scrollbar">
        {/* TAB CONTENTS */}
        {activeTab === 'session' && (
          <SessionDashboard 
            session={session}
            elapsedTime={elapsedTime}
            setShowCheckoutConfirm={setShowCheckoutConfirm}
            handleRequestPause={handleRequestPause}
            handleResumeSession={handleResumeSession}
            ptsPerHour={ptsPerHour}
            cbRatio={cbRatio}
            showCheckoutConfirm={showCheckoutConfirm}
            handleCheckoutRequest={handleCheckoutRequest}
          />
        )}
        
        {activeTab === 'catering' && (
          <CateringStore 
            cateringItems={cateringItems}
            cart={cart}
            storeSearch={storeSearch}
            setStoreSearch={setStoreSearch}
            storeCategory={storeCategory}
            setStoreCategory={setStoreCategory}
            viewMode={viewMode}
            setViewMode={setViewMode}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            handleCheckoutCart={handleCheckoutCart}
            orderLoading={orderLoading}
            session={session}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileSection 
            profileData={profileData}
            totalMinutes={totalMinutes}
            userCompany={userCompany}
            isUserLeader={isUserLeader}
            userCompanyMembers={userCompanyMembers}
            companyContract={companyContract}
            activeSub={activeSub}
            isConverting={isConverting}
            convertPointsToCashback={convertPointsToCashback}
            checkCompanyMembership={checkCompanyMembership}
            setLeaderData={setLeaderData}
            session={session}
            ptsPerHour={ptsPerHour}
            cbRatio={cbRatio}
          />
        )}
        {activeTab === 'about' && (
          <div className="w-full max-w-lg mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-20">
             <div className="bg-[#0B0F19]/60 backdrop-blur-3xl border border-white/5 p-10 md:p-12 rounded-[2.5rem] relative overflow-hidden shadow-2xl text-right">
              <div className="absolute top-0 left-0 w-64 h-64 bg-[#1e75b9]/20 rounded-full blur-[100px] -translate-x-12 -translate-y-12" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#1ed788]/10 rounded-full blur-[80px] translate-x-20 translate-y-20" />
              
              <div className="relative z-10 text-center mb-12">
                 <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Cloud Co-Working</h2>
                 <div className="h-1.5 w-20 bg-indigo-500 mx-auto rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                 <p className="text-slate-400 mt-6 font-bold leading-relaxed max-w-sm mx-auto">
                    المكان الأمثل الذي يجمع بين هدوء التركيز، وحيوية الإبداع، وخدمات الضيافة الراقية.
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {[
                  { title: 'إنترنت فائق', desc: 'سرعات تصل لـ 200 ميجا لتحميل شغلك بلا توقف.', icon: Zap, color: 'text-indigo-400' },
                  { title: 'هدوء كامل', desc: 'عزل صوتي تام يضمن لك أقصى درجات التركيز.', icon: Wind, color: 'text-blue-400' },
                  { title: 'أمان وخصوصية', desc: 'خزائن خاصة ونظام غرف اجتماعات محمي.', icon: Lock, color: 'text-emerald-400' },
                  { title: 'ضيافة مميزة', desc: 'مشروبات وسناكس من اختيارك طوال اليوم.', icon: Coffee, color: 'text-amber-400' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/5 p-6 rounded-[2rem] group hover:bg-white/10 transition-all duration-300">
                    <item.icon className={`${item.color} mb-4 group-hover:scale-110 transition-transform`} size={28} />
                    <h4 className="text-white font-black text-lg mb-2">{item.title}</h4>
                    <p className="text-slate-500 text-xs font-bold leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-white/5 text-center relative z-10">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Designed for Pioneers</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'how_work' && (
          <div className="w-full max-w-lg mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 text-right pb-20">
            <div className="bg-[#0B0F19]/60 backdrop-blur-3xl border border-white/5 p-12 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#1ed788]/20 rounded-full blur-[100px] translate-x-20 -translate-y-20" />
              
              <div className="text-center mb-16 relative z-10">
                <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">دليل الاستخدام</h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Cloud Membership Roadmap</p>
              </div>

              <div className="space-y-12 relative z-10">
                {[
                   { title: 'تسجيل الدخول', desc: 'بمجرد كتابة الكود الخاص بك، سيبدأ العداد في العمل تلقائياً.', icon: Clock, color: 'bg-indigo-500' },
                   { title: 'نظام محاسبة الدقيقة', desc: 'ساعة العمل بـ 10 جنيهات فقط، والحساب يتم بالدقيقة لضمان حقك.', icon: Zap, color: 'bg-blue-500' },
                   { title: 'الحد الأدنى للدخول', desc: 'أقل تكلفة للزيارة هي 10 جنيهات فقط (أول ساعة).', icon: User, color: 'bg-emerald-500' },
                   { title: 'طلبات الكافيتريا', desc: 'كل ما تطلبه من المتجر يضاف فوراً لفاتورتك وتتم المحاسبة عند الخروج.', icon: ShoppingBag, color: 'bg-amber-500' }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-6 relative">
                    {idx !== 3 && <div className="absolute top-12 bottom-[-48px] right-6 w-1 bg-gradient-to-b from-white/10 to-transparent rounded-full" />}
                    <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center font-black text-white shadow-xl shadow-black/20 shrink-0 z-10 relative group-hover:scale-110 transition-transform`}>
                      <item.icon size={22} strokeWidth={2.5} />
                    </div>
                    <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex-1 hover:bg-white/10 transition-all">
                      <strong className="text-white text-lg font-black block mb-2">{item.title}</strong>
                      <span className="text-sm text-slate-400 font-bold leading-relaxed block">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 text-center">
                 <button 
                   onClick={() => setActiveTab('session')} 
                   className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                 >
                   فهمت، لنبدأ الجلسة
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-20 bg-[#0B0F19]/90 backdrop-blur-3xl border-t border-white/10 z-50 px-4 md:px-0 flex justify-center pb-safe">
        <div className="w-full max-md h-full flex justify-between items-center px-2">
          {[
            { id: 'session', icon: Clock, label: 'الرئيسية' },
            { id: 'catering', icon: ShoppingBag, label: 'المتجر', action: fetchStoreItems },
            { id: 'profile', icon: User, label: 'بروفايلي' },
            { id: 'about', icon: Info, label: 'من نحن' },
            { id: 'how_work', icon: HelpCircle, label: 'الأسئلة' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); if (tab.action) tab.action(); }} 
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all relative ${
                  isActive ? 'text-[#1ed788]' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon size={isActive ? 20 : 18} className={`transition-all ${isActive ? 'mb-1 drop-shadow-[0_0_8px_rgba(30,215,136,0.8)] scale-110' : ''}`} />
                <span className={`text-[9px] font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>{tab.label}</span>
                {isActive && (
                  <div className="absolute top-0 w-8 h-1 bg-[#1ed788] rounded-b-full shadow-[0_4px_10px_rgba(30,215,136,0.5)]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Floating Checkout Button */}
      {activeTab === 'catering' && Object.keys(cart).length > 0 && (
        <div className="fixed bottom-24 left-6 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-500">
           <button
              onClick={handleCheckoutCart}
              disabled={orderLoading}
              className="group relative flex items-center gap-4 bg-indigo-600 hover:bg-indigo-500 text-white pl-6 pr-4 py-4 rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.4)] transition-all active:scale-95 disabled:opacity-50"
           >
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition-opacity" />
              
              <div className="relative text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 leading-none mb-1">تأكيد الشراء</p>
                <p className="text-lg font-black leading-none">إتمام الطلب</p>
              </div>

              <div className="relative w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                {orderLoading ? (
                  <RefreshCw className="animate-spin" size={24} />
                ) : (
                  <div className="relative">
                    <ShoppingBag size={24} />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-indigo-600">
                      {Object.values(cart).reduce((s, e: any) => s + e.quantity, 0)}
                    </div>
                  </div>
                )}
              </div>
           </button>
        </div>
      )}
    </div>
  );
};
