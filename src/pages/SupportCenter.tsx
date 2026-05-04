import React, { useState, useEffect } from 'react';
import { Radio, Users, MessageSquare, Shield, Clock, PhoneCall } from 'lucide-react';
import { supabase } from '../lib/supabase';
import WalkieTalkie from '../components/workspace/WalkieTalkie';

export const SupportCenter = ({ branchId }: { branchId?: string }) => {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAdminUser(user);
    });

    if (branchId) {
      const fetchCount = async () => {
        const { count } = await supabase
          .from('workspace_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', branchId)
          .eq('status', 'active');
        setActiveSessions(count || 0);
      };
      fetchCount();
      
      const sub = supabase
        .channel('support_counts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_sessions' }, () => fetchCount())
        .subscribe();
      
      return () => { supabase.removeChannel(sub); };
    }
  }, [branchId]);

  if (!adminUser || !branchId) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-6 text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-500">
            <Radio size={32} />
          </div>
          <p className="text-slate-400 font-bold">جاري تجهيز مركز الدعم...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white font-['Cairo'] pb-20 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-6 pt-12 pb-8 border-b border-white/5 bg-[#0B0F19]/60 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-2 flex-row-reverse">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield size={20} />
            </div>
            <div className="text-right">
              <h1 className="text-xl font-black">مركز الدعم الصوتي</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Support Center Mobile</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/5 p-5 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/10 rounded-bl-3xl blur-xl" />
            <Users className="text-indigo-400 mb-3" size={20} />
            <p className="text-2xl font-black text-white">{activeSessions}</p>
            <p className="text-[10px] font-bold text-slate-500">عملاء نشطون</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-5 rounded-3xl relative overflow-hidden">
            <Clock className="text-amber-400 mb-3" size={20} />
            <p className="text-2xl font-black text-white">0</p>
            <p className="text-[10px] font-bold text-slate-500">طلبات انتظار</p>
          </div>
        </div>

        {/* Support Instructions Card */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl shadow-indigo-900/40">
           <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-10 -translate-y-10 blur-2xl" />
           <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                 <PhoneCall size={32} />
              </div>
              <div>
                 <h3 className="text-lg font-black mb-1">استعداد تام للمساعدة</h3>
                 <p className="text-xs font-bold text-white/70 leading-relaxed">
                    انت الآن متاح لاستقبال المكالمات الصوتية من العملاء. يرجى إبقاء هذه الصفحة مفتوحة لتصلك الإشعارات.
                 </p>
              </div>
           </div>
        </div>

        {/* Recent Activity Label */}
        <div className="flex items-center justify-between px-2 flex-row-reverse">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تنبيهات الدعم</span>
           <MessageSquare size={14} className="text-indigo-400" />
        </div>

        {/* Call Management Section */}
        <div className="relative z-10">
          <WalkieTalkie 
            userId={adminUser.id} 
            userName={adminUser.user_metadata?.full_name || 'Admin'} 
            branchId={branchId} 
            isAdmin={true} 
            isEmbedded={true}
          />
        </div>

        {/* Empty State / Listening Indicator - Only show if not in a call */}
        <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center text-center space-y-4">
           <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 flex items-center justify-center relative">
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <Radio size={32} className="text-indigo-500" />
           </div>
           <div className="space-y-1">
              <p className="font-black text-white">في انتظار طلبات الدعم</p>
              <p className="text-xs font-bold text-slate-500">سيظهر تنبيه صوتي ومرئي فور طلب أحد العملاء للمساعدة</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SupportCenter;
