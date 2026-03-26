
import React, { useState, useEffect } from 'react';
import { UserCheck, Wallet, Calendar, Users, TrendingUp, Loader2, RefreshCcw } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui';
import { supabase } from '../lib/supabase';

export const Dashboard = ({ branchId }: { branchId?: string }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    presentNow: 0,
    dailyRevenue: 0,
    roomOccupancy: 0,
    newMembersToday: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    retentionRate: 0,
    dailyRevenueHistory: [] as { date: string, amount: number }[],
    revenueTrend: 0,
    subscriptionTrend: 0,
    membersTrend: 0,
    totalMembers: 0,
  });

  useEffect(() => {
    if (branchId) fetchDashboardStats();
  }, [branchId]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 1. Attendance Now (workspace_sessions)
      const { count: presentNow, error: err1 } = await supabase
        .from('workspace_sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'checkout_requested']);
      if (err1) throw err1;

      // 2. Daily Revenue
      const { data: sessionsToday, error: err2 } = await supabase
        .from('workspace_sessions')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', todayISO); // Assuming creating or completely checking out today
      if (err2) throw err2;
      const dailyRevenue = sessionsToday?.reduce((acc, v) => acc + (Number(v.total_amount) || 0), 0) || 0;

      // 3. New Members Today
      const { count: newMembersToday, error: err3 } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('home_branch_id', branchId)
        .gte('created_at', todayISO);
      if (err3) throw err3;

      // 3.5. Total Members
      const { count: totalMembers, error: err3_5 } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });
      if (err3_5) throw err3_5;

      // 4. Subscriptions
      const { data: subs, error: err4 } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('branch_id', branchId);
      if (err4) throw err4;

      const totalSubscriptions = subs?.length || 0;
      const activeSubscriptions = subs?.filter(s => s.status === 'Active').length || 0;
      const expiredSubscriptions = totalSubscriptions - activeSubscriptions;

      // 5. Room Occupancy (Mock logic based on bookings today vs total capacity)
      const { count: activeBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('booking_date', today.toISOString().split('T')[0])
        .eq('status', 'Confirmed');

      const { data: rooms } = await supabase
        .from('services')
        .select('capacity')
        .eq('branch_id', branchId)
        .eq('service_type', 'Room');

      const totalCapacity = rooms?.reduce((acc, r) => acc + (r.capacity || 0), 0) || 10; // Default 10 if no rooms
      const roomOccupancy = Math.min(100, Math.round(((activeBookings || 0) / totalCapacity) * 100));

      setStats(prev => ({
        ...prev,
        presentNow: presentNow || 0,
        dailyRevenue,
        newMembersToday: newMembersToday || 0,
        totalSubscriptions,
        activeSubscriptions,
        expiredSubscriptions,
        roomOccupancy,
        totalMembers: totalMembers || 0,
      }));

      // 6. Retention Rate (% of customers with > 1 visit)
      const { data: allVisits, error: err6 } = await supabase
        .from('workspace_sessions')
        .select('customer_id')
        .eq('status', 'completed');

      if (!err6 && allVisits) {
        const customerVisitCounts = allVisits.reduce((acc: any, v) => {
          if (v.customer_id) {
            acc[v.customer_id] = (acc[v.customer_id] || 0) + 1;
          }
          return acc;
        }, {});

        const totalCustomers = Object.keys(customerVisitCounts).length;
        const recurringCustomers = Object.values(customerVisitCounts).filter((count: any) => count > 1).length;
        const retentionRate = totalCustomers > 0 ? Math.round((recurringCustomers / totalCustomers) * 100) : 0;

        setStats(prev => ({ ...prev, retentionRate }));
      }

      // 7. Calculate Real Trends (Compare today vs yesterday)
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayISO = yesterday.toISOString();

      const { data: sessionsYesterday } = await supabase
        .from('workspace_sessions')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', yesterdayISO)
        .lt('created_at', todayISO);

      const yesterdayRevenue = sessionsYesterday?.reduce((acc, v) => acc + (Number(v.total_amount) || 0), 0) || 0;
      const revenueTrend = yesterdayRevenue > 0 ? Math.round(((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0;

      // 8. Calculate Subscription Trend
      const { count: subsPrevMonth } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .lt('created_at', todayISO); 
        
      const subscriptionTrend = subsPrevMonth && subsPrevMonth > 0 ? Math.round(((totalSubscriptions - subsPrevMonth) / subsPrevMonth) * 100) : 0;

      // 9. Members Trend
      const { count: membersYesterday } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('home_branch_id', branchId)
        .gte('created_at', yesterdayISO)
        .lt('created_at', todayISO);
      
      const membersTrend = membersYesterday && membersYesterday > 0 ? Math.round(((newMembersToday - membersYesterday) / membersYesterday) * 100) : (newMembersToday > 0 ? 100 : 0);

      // 10. Fetch Last 7 Days Revenue
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        return d;
      }).reverse();

      const last7DaysRevenue = await Promise.all(last7Days.map(async (day) => {
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        
        const { data: daySess } = await supabase
          .from('workspace_sessions')
          .select('total_amount')
          .eq('status', 'completed')
          .gte('created_at', day.toISOString())
          .lt('created_at', nextDay.toISOString());
          
        return {
          date: day.toLocaleDateString('ar-EG', { weekday: 'short' }),
          amount: daySess?.reduce((acc, v) => acc + (Number(v.total_amount) || 0), 0) || 0
        };
      }));

      setStats(prev => ({ 
        ...prev, 
        revenueTrend,
        subscriptionTrend,
        membersTrend,
        dailyRevenueHistory: last7DaysRevenue
      }));

    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-['Cairo'] text-right">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-black text-slate-800">لوحة التحكم</h2>
        <button
          onClick={fetchDashboardStats}
          disabled={loading}
          className="p-3 bg-white/50 border border-white/60 shadow-sm rounded-2xl hover:bg-white transition-all hover:shadow hover:scale-105 active:scale-95 disabled:opacity-50 group"
          title="تحديث البيانات"
        >
          <RefreshCcw size={22} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-500 group-hover:text-indigo-600 group-hover:rotate-180 transition-all duration-500'} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] z-10 rounded-3xl" />
        )}
        <StatCard title="الحضور الآن" value={stats.presentNow.toString()} icon={UserCheck} />
        <StatCard title="إيراد اليوم (EGP)" value={stats.dailyRevenue.toLocaleString()} icon={Wallet} trend={stats.revenueTrend} />
        <StatCard title="إجمالي العملاء" value={stats.totalMembers.toLocaleString()} icon={Users} />
        <StatCard title="أعضاء جدد" value={stats.newMembersToday.toString()} icon={Users} trend={stats.membersTrend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardHeader>
            <CardTitle>تحليلات الأداء</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 bg-white/40 rounded-[1.5rem] flex items-end justify-between px-8 py-10 border-2 border-dashed border-slate-200/50 relative overflow-hidden group/chart">
              {stats.dailyRevenueHistory.length > 0 ? (
                stats.dailyRevenueHistory.map((day, idx) => {
                  const maxVal = Math.max(...stats.dailyRevenueHistory.map(d => d.amount), 1);
                  const height = (day.amount / maxVal) * 100;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 group/bar flex-1 h-full justify-end px-1">
                      <div className="relative w-full flex justify-center group/tooltip">
                        <div 
                           className="w-full max-w-[40px] bg-gradient-to-t from-indigo-500 to-violet-400 rounded-t-xl transition-all duration-1000 hover:scale-x-110 shadow-lg"
                           style={{ height: `${Math.max(5, height)}%` }}
                        />
                        <div className="absolute -top-10 scale-0 group-hover/tooltip:scale-100 transition-transform bg-slate-800 text-white text-[10px] py-1.5 px-3 rounded-lg font-black shadow-xl z-10 whitespace-nowrap">
                          {day.amount} EGP
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400">{day.date}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                  <TrendingUp size={40} className="mb-2" />
                  <p className="text-sm font-black">لا توجد بيانات كافية</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-500" />
          <CardHeader>
            <CardTitle>تحليلات الاشتراكات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total Subscriptions */}
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-5 border border-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-transform">
              <p className="text-slate-500 font-bold text-xs mb-2">إجمالي الاشتراكات</p>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">{stats.totalSubscriptions}</span>
                <span className={`text-xs font-black ${stats.subscriptionTrend >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'} px-2.5 py-1.5 rounded-xl border shadow-sm transition-transform hover:scale-105 cursor-default`}>
                  {stats.subscriptionTrend >= 0 ? '+' : ''}{stats.subscriptionTrend}%
                </span>
              </div>
            </div>

            {/* Active vs Expired */}
            <div className="space-y-3 p-2">
              <div className="flex justify-between text-[13px] font-black">
                <span className="text-slate-500">نشط / منتهي</span>
                <span className="text-slate-800">{stats.activeSubscriptions} <span className="text-slate-300 mx-1">/</span> {stats.expiredSubscriptions}</span>
              </div>
              <div className="h-4 bg-slate-100/80 rounded-full overflow-hidden flex shadow-inner border border-slate-200/50">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full relative overflow-hidden group-hover:brightness-110 transition-all duration-1000"
                  style={{ width: `${(stats.activeSubscriptions / stats.totalSubscriptions) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-1/2 skew-x-12 -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>
                <div className="bg-rose-100 h-full flex-1 transition-colors duration-500 group-hover:bg-rose-200"></div>
              </div>
            </div>

            {/* Retention Rate */}
            <div className="flex items-center gap-5 p-5 bg-white/40 border border-white shadow-sm rounded-2xl hover:bg-white/60 transition-colors cursor-pointer group/retention">
              <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-sm">
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={213.6} strokeDashoffset={213.6 - (213.6 * stats.retentionRate) / 100} className="text-indigo-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                </svg>
                <span className="absolute text-lg font-black text-indigo-900 group-hover/retention:scale-110 transition-transform">{stats.retentionRate}%</span>
              </div>
              <div>
                <p className="font-black text-slate-800 text-[15px]">معدل الحفاظ على العملاء</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${stats.retentionRate > 50 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <p className="text-xs text-slate-500 font-bold">
                    {stats.retentionRate > 50 ? 'أداء ممتاز في الحفاظ على العملاء' : 'بحاجة لتحسين استبقاء العملاء'}
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};
