
import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, PieChart, BarChart3,
  ArrowUpRight, DollarSign, Calendar, ChevronRight,
  ChevronLeft, Plus, Save, Calculator, CheckCircle2,
  AlertCircle, Receipt, Printer, X, Wallet, ArrowRightLeft,
  ChevronUp, ChevronDown, Lock, Edit
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

export const FinancePanel = ({ branchId }: { branchId?: string }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'annual'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [dailyData, setDailyData] = useState({
    income: 0,
    expense: 0,
    details: { catering: 0, rooms: 0, workspace: 0 }
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [financeSummary, setFinanceSummary] = useState({
    total_in: 0,
    total_out: 0,
    total_cash: 0,
    cash_cloud: 0,
    cash_athar: 0
  });
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState({ ...financeSummary });

  // Real Petty Cash Database State
  const [pettyTransactions, setPettyTransactions] = useState<any[]>([]);

  // Modal States
  const [showPettyModal, setShowPettyModal] = useState<'add' | 'withdraw' | null>(null);
  const [showCloseMonthModal, setShowCloseMonthModal] = useState(false);
  const [pettyActionValue, setPettyActionValue] = useState('');
  const [pettyNote, setPettyNote] = useState('');
  const [rolloverOption, setRolloverOption] = useState<'rollover' | 'settle'>('rollover');
  const [notification, setNotification] = useState<string | null>(null);

  // Closed Months "Database" (Real Integration)
  const [closedMonths, setClosedMonths] = useState<{ [key: string]: any }>({});

  // Cash Drawer State
  const [cashDrawer, setCashDrawer] = useState<{ [key: number]: string }>({
    200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 1: ''
  });

  const denominations = [200, 100, 50, 20, 10, 5, 1];

  // Calculations
  const pettyCashStats = useMemo(() => {
    return pettyTransactions.reduce((acc, curr) => {
      if (curr.type === 'add') acc.added += Number(curr.amount);
      else acc.withdrawn += Number(curr.amount);
      return acc;
    }, { added: 0, withdrawn: 0 });
  }, [pettyTransactions]);

  useEffect(() => {
    if (branchId) {
      fetchData();
      
      const channel = supabase.channel('finance_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash' }, () => fetchPettyTransactions())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_closings' }, () => fetchClosedMonths())
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, [branchId, currentDate, activeTab, viewDate]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDailyFinance(),
      fetchPettyTransactions(),
      fetchClosedMonths(),
      fetchFinanceSummary()
    ]);
    setLoading(false);
  };

  const fetchFinanceSummary = async () => {
    if (!branchId) return;
    const { data, error } = await (supabase as any)
      .from('finance_summary')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();
      
    if (data) {
      setFinanceSummary(data);
      setSummaryForm(data);
    }
  };

  const saveFinanceSummary = async () => {
    try {
      setLoading(true);
      const { error } = await (supabase as any)
        .from('finance_summary')
        .upsert({
          branch_id: branchId,
          ...summaryForm,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      setFinanceSummary(summaryForm);
      setEditingSummary(false);
      showNotification('تم حفظ ملخص الخزينة بنجاح');
    } catch (err: any) {
      alert('خطأ في الحفظ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  const fetchPettyTransactions = async () => {
    if (!branchId) return;
    const { data } = await (supabase as any)
      .from('petty_cash')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    setPettyTransactions(data || []);
  };

  const fetchClosedMonths = async () => {
    if (!branchId) return;
    const { data } = await (supabase as any)
      .from('monthly_closings')
      .select('*')
      .eq('branch_id', branchId);

    if (data) {
      const monthMap = data.reduce((acc: any, m: any) => {
        acc[m.month_key] = { income: m.total_income, expense: m.total_expense, net: m.net_profit };
        return acc;
      }, {});
      setClosedMonths(monthMap);
    }
  };

  const fetchDailyFinance = async () => {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      // 1. Fetch Workspace Sessions Income
      const { data: sessions } = await supabase
        .from('workspace_sessions')
        .select('total_amount, catering_amount')
        .eq('status', 'completed')
        .gte('end_time', `${dateStr}T00:00:00`)
        .lte('end_time', `${dateStr}T23:59:59`);

      // 2. Fetch Subscriptions Income
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('price')
        .eq('branch_id', branchId)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`);

      // 3. Fetch Daily Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('branch_id', branchId)
        .eq('date', dateStr);

      let workspace = 0, catering = 0;
      sessions?.forEach(s => {
        const cat = s.catering_amount || 0;
        const total = s.total_amount || 0;
        catering += Number(cat);
        workspace += (Number(total) - Number(cat));
      });

      const subIncome = subs?.reduce((s, b) => s + (Number(b.price) || 0), 0) || 0;
      const totalIncome = workspace + catering + subIncome;
      const totalExpense = expenses?.reduce((s, e) => s + (Number(e.amount) || 0), 0) || 0;

      setDailyData({
        income: totalIncome,
        expense: totalExpense,
        details: { catering, rooms: 0, workspace: workspace + subIncome }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMonthlyFinance = async () => {
    setLoading(true);
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split('T')[0];

    try {
      // 1. Fetch Monthly Workspace Sessions
      const { data: sessions } = await supabase
        .from('workspace_sessions')
        .select('total_amount, catering_amount')
        .eq('status', 'completed')
        .gte('end_time', `${firstDay}T00:00:00`)
        .lte('end_time', `${lastDay}T23:59:59`);

      // 2. Fetch Monthly Subscriptions
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('price')
        .gte('created_at', `${firstDay}T00:00:00`)
        .lte('created_at', `${lastDay}T23:59:59`);

      // 3. Fetch Monthly Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', firstDay)
        .lte('date', lastDay);

      let workspace = 0, catering = 0;
      sessions?.forEach(s => {
        const cat = s.catering_amount || 0;
        const total = s.total_amount || 0;
        catering += cat;
        workspace += (total - cat);
      });

      const subIncome = subs?.reduce((s: number, b: any) => s + (b.price || 0), 0) || 0;
      const totalIncome = workspace + catering + subIncome;
      const totalExpense = expenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;

      setDailyData({
        income: totalIncome,
        expense: totalExpense,
        details: { catering, rooms: 0, workspace: workspace + subIncome }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalCountedCash = denominations.reduce((sum, den) => {
    const count = parseInt(cashDrawer[den] || '0');
    return sum + (count * den);
  }, 0);

  const expectedCash = dailyData.income - dailyData.expense + (pettyCashStats.added - pettyCashStats.withdrawn);
  const cashDiff = totalCountedCash - expectedCash;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePettyAction = async () => {
    const val = parseFloat(pettyActionValue);
    if (!isNaN(val)) {
      try {
        const { error } = await (supabase as any).from('petty_cash').insert({
          branch_id: branchId,
          type: showPettyModal as 'add' | 'withdraw',
          amount: val,
          note: pettyNote || (showPettyModal === 'add' ? 'إضافة عهدة' : 'سحب عهدة'),
          date: new Date().toISOString().split('T')[0]
        });

        if (error) throw error;
        showNotification('تمت تسجيل حركة العهدة');
        setShowPettyModal(null);
        setPettyActionValue('');
        setPettyNote('');
        fetchPettyTransactions();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSaveDay = async () => {
    try {
      const { error } = await (supabase as any).from('daily_closings').insert({
        branch_id: branchId,
        date: currentDate.toISOString().split('T')[0],
        expected_cash: expectedCash,
        actual_cash: totalCountedCash,
        difference: cashDiff,
        denominations: cashDrawer
      });

      if (error) throw error;
      showNotification('تم حفظ جرد اليوم وإقفال الصندوق بنجاح');
    } catch (err: any) {
      alert('خطأ في الحفظ: ' + err.message);
    }
  };

  const handleCloseMonth = async () => {
    const monthKey = viewDate.toISOString().slice(0, 7);
    const m_income = dailyData.income + pettyCashStats.added;
    const m_expense = dailyData.expense + pettyCashStats.withdrawn;

    try {
      const { error } = await (supabase as any).from('monthly_closings').upsert({
        branch_id: branchId,
        month_key: monthKey,
        total_income: m_income,
        total_expense: m_expense,
        net_profit: m_income - m_expense
      });

      if (error) throw error;
      
      showNotification(`تم تقفيل شهر ${monthKey} بنجاح`);
      setShowCloseMonthModal(false);
      fetchClosedMonths();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getDiffColor = () => {
    if (cashDiff === 0 && totalCountedCash > 0) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (cashDiff < 0) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (cashDiff > 0) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-400 bg-slate-50 border-slate-100';
  };

  const renderDaily = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="إجمالي دخل اليوم" value={dailyData.income.toLocaleString()} icon={TrendingUp} trend={8} />
        <StatCard title="مصروفات اليوم" value={dailyData.expense.toLocaleString()} icon={TrendingDown} />
        <StatCard title="دخل الكاترينج" value={dailyData.details.catering.toLocaleString()} icon={PieChart} />
        <StatCard title="دخل الغرف" value={dailyData.details.rooms.toLocaleString()} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl">
                <Calculator size={24} />
              </div>
              <div>
                <CardTitle>جرد خزينة اليوم (الدرج)</CardTitle>
                <CardDescription>أدخل عدد الورقات النقدية لمطابقة العجز والزيادة</CardDescription>
              </div>
            </div>
            <div className={`px-6 py-3 rounded-2xl border-2 font-black transition-all ${getDiffColor()}`}>
              الفرق: {cashDiff.toLocaleString()} ج.م
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
              {denominations.map(den => (
                <div key={den} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-300 transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{den} ج.م</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={cashDrawer[den]}
                    onChange={(e) => setCashDrawer({ ...cashDrawer, [den]: e.target.value })}
                    className="text-xl font-black border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                  />
                </div>
              ))}
              <div className="p-4 bg-indigo-600 text-white rounded-2xl flex flex-col justify-center">
                <p className="text-[10px] font-black opacity-60 uppercase">الإجمالي المحسوب</p>
                <p className="text-2xl font-black">{totalCountedCash.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 bg-slate-900 rounded-[2rem] text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <DollarSign size={24} className="text-indigo-300" />
                </div>
                <div>
                  <p className="text-xs font-bold opacity-60">المفروض تواجده (حسب النظام)</p>
                  <p className="text-2xl font-black">{expectedCash.toLocaleString()} EGP</p>
                </div>
              </div>
              <Button onClick={handleSaveDay} size="lg" className="bg-white text-slate-900 hover:bg-slate-100 rounded-2xl gap-2 font-black">
                <Save size={18} /> حفظ وإقفال اليوم
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black"><PieChart size={20} className="text-indigo-600" /> تحليل مصادر الدخل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { label: 'المساحة المشتركة', amount: dailyData.details.workspace, color: 'bg-indigo-500' },
              { label: 'حجوزات القاعات', amount: dailyData.details.rooms, color: 'bg-emerald-500' },
              { label: 'طلبات الكاترينج', amount: dailyData.details.catering, color: 'bg-amber-500' },
            ].map((cat, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-600">{cat.label}</span>
                  <span className="font-black text-slate-800">{cat.amount.toLocaleString()} ج.م</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${(cat.amount / (dailyData.income || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-6 border-t border-slate-100 mt-6 p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-slate-100 text-indigo-600 shadow-sm"><TrendingUp size={16} /></div>
              <p className="text-[11px] font-bold text-slate-500 leading-tight">أداء اليوم أعلى بنسبة <span className="text-emerald-600">8%</span> من المتوسط اليومي</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Treasury Summary Section */}
      <Card className="border-none shadow-xl shadow-slate-100 overflow-hidden mt-8">
        <CardHeader className="flex flex-row items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <Wallet size={20} />
            </div>
            <CardTitle className="text-xl font-black">ملخص الخزينة (Cloud / Athar)</CardTitle>
          </div>
          {!editingSummary ? (
            <Button onClick={() => setEditingSummary(true)} variant="outline" className="rounded-xl font-black gap-2 border-slate-200">
              <Edit size={16} /> تعديل البيانات
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setEditingSummary(false)} variant="ghost" className="rounded-xl font-black text-slate-400">إلغاء</Button>
              <Button onClick={saveFinanceSummary} className="rounded-xl font-black gap-2 bg-indigo-600 text-white">
                <CheckCircle2 size={16} /> حفظ التغييرات
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {(['total_in', 'total_out', 'total_cash', 'cash_cloud', 'cash_athar'] as const).map((key) => {
              const labels: Record<string, string> = {
                total_in: 'إجمالي الداخل',
                total_out: 'إجمالي الخارج',
                total_cash: 'إجمالي الكاش',
                cash_cloud: 'كاش Cloud',
                cash_athar: 'كاش Athar'
              };
              const colors: Record<string, string> = {
                total_in: 'text-emerald-600',
                total_out: 'text-rose-600',
                total_cash: 'text-indigo-600',
                cash_cloud: 'text-sky-600',
                cash_athar: 'text-amber-600'
              };
              const Icons: Record<string, any> = {
                total_in: TrendingUp,
                total_out: TrendingDown,
                total_cash: Wallet,
                cash_cloud: PieChart,
                cash_athar: BarChart3
              };
              const Icon = Icons[key];

              return (
                <div key={key} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] group hover:border-indigo-300 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={14} className="text-slate-400" />
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{labels[key]}</label>
                  </div>
                  {!editingSummary ? (
                    <p className={`text-2xl font-black ${colors[key]}`}>
                      {Number(financeSummary[key as keyof typeof financeSummary] || 0).toLocaleString()} <span className="text-xs opacity-60">ج.م</span>
                    </p>
                  ) : (
                    <Input
                      type="number"
                      value={summaryForm[key as keyof typeof summaryForm]}
                      onChange={(e) => setSummaryForm({ ...summaryForm, [key]: parseFloat(e.target.value) || 0 })}
                      className="text-xl font-black border-none bg-white/50 rounded-xl focus-visible:ring-indigo-400 h-14 text-center"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMonthly = () => {
    const totalMonthlyIncome = dailyData.income; // Placeholder for now
    const totalMonthlyExpense = dailyData.expense; // Placeholder for now

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><TrendingUp size={28} /></div>
            <div>
              <p className="text-xs font-black text-slate-400">إجمالي الدخل + العهدة المضافة</p>
              <p className="text-2xl font-black text-slate-900">{totalMonthlyIncome.toLocaleString()} ج.م</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center"><TrendingDown size={28} /></div>
            <div>
              <p className="text-xs font-black text-slate-400">إجمالي المصروفات + العهدة المسحوبة</p>
              <p className="text-2xl font-black text-slate-900">{totalMonthlyExpense.toLocaleString()} ج.م</p>
            </div>
          </div>
          <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center"><Wallet size={28} /></div>
            <div className="flex-1">
              <p className="text-xs font-black opacity-60">رصيد العهدة الحالي</p>
              <div className="flex justify-between items-end">
                <p className="text-2xl font-black">{(pettyCashStats.added - pettyCashStats.withdrawn).toLocaleString()} ج.م</p>
                <Button
                  onClick={() => setShowCloseMonthModal(true)}
                  className="bg-indigo-600 text-white rounded-xl h-10 px-4 font-black hover:bg-indigo-700 animate-pulse border-2 border-indigo-400"
                >
                  تـقـفـيـل الـشـهـر
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-xl shadow-slate-100 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-600 font-bold text-sm shadow-sm">
                <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}><ChevronRight size={18} /></button>
                <span className="min-w-[120px] text-center font-black">{viewDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}><ChevronLeft size={18} /></button>
              </div>
              <div>
                <CardTitle>كشف التفاصيل اليومية</CardTitle>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowPettyModal('add')} variant="outline" className="rounded-xl gap-2 font-black border-2 border-emerald-100 text-emerald-600 bg-emerald-50 hover:bg-emerald-100">
                <Plus size={18} /> إضافة عهدة
              </Button>
              <Button onClick={() => setShowPettyModal('withdraw')} variant="outline" className="rounded-xl gap-2 font-black border-2 border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-100">
                <ArrowRightLeft size={18} /> سحب عهدة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50/80 border-y border-slate-100">
                  <tr>
                    <th className="px-8 py-5 font-black text-slate-500 text-xs">التاريخ</th>
                    <th className="px-8 py-5 font-black text-slate-500 text-xs">إجمالي الدخل</th>
                    <th className="px-8 py-5 font-black text-slate-500 text-xs">إجمالي المصروفات</th>
                    <th className="px-8 py-5 font-black text-slate-500 text-xs text-left">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {/* Petty Cash Transactions */}
                  {pettyTransactions.map((t, i) => (
                    <tr key={`petty-${i}`} className={t.type === 'add' ? 'bg-emerald-50/30' : 'bg-rose-50/30'}>
                      <td className="px-8 py-4 font-black text-sm">
                        <span className={t.type === 'add' ? 'text-emerald-700' : 'text-rose-700'}>
                          {t.type === 'add' ? 'عهدة مضافة' : 'عهدة مسحوبة'}
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold">{t.date}</p>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className="text-xs font-bold text-slate-500 bg-white/50 px-3 py-1 rounded-full border border-slate-100">{t.note}</span>
                      </td>
                      <td className="px-8 py-4 font-black text-sm">
                        {t.type === 'add' ? <span className="text-emerald-600">+{t.amount.toLocaleString()} ج.م</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-8 py-4 font-black text-sm">
                        {t.type === 'withdraw' ? <span className="text-rose-600">{t.amount.toLocaleString()} ج.م</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className={`px-8 py-4 text-left font-black text-sm ${t.type === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'add' ? `+${t.amount.toLocaleString()}` : `-${t.amount.toLocaleString()}`} ج.م
                      </td>
                    </tr>
                  ))}
                  {/* Daily Rows */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 font-bold text-slate-700 text-sm">{currentDate.toLocaleDateString()}</td>
                    <td className="px-8 py-4 text-center text-[10px] text-slate-300">-</td>
                    <td className="px-8 py-4 font-black text-slate-900 text-sm">{dailyData.income.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></td>
                    <td className="px-8 py-4 font-bold text-rose-500 text-sm">{dailyData.expense.toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span></td>
                    <td className={`px-8 py-4 font-black text-sm text-left ${dailyData.income - dailyData.expense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(dailyData.income - dailyData.expense).toLocaleString()} ج.م
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td colSpan={2} className="px-8 py-6 font-black text-lg">الإجمالي النهائي</td>
                    <td className="px-8 py-6 font-black text-xl text-indigo-300">{dailyData.income.toLocaleString()} ج.م</td>
                    <td className="px-8 py-6 font-black text-xl text-rose-300">{dailyData.expense.toLocaleString()} ج.م</td>
                    <td className="px-8 py-6 font-black text-2xl text-left bg-indigo-600 rounded-bl-[2.5rem]">{(dailyData.income - dailyData.expense).toLocaleString()} ج.م</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAnnual = () => {
    // Aggregation from closed months + current
    const months = Object.keys(closedMonths);
    const totalYearIncome = months.reduce((s, m) => s + closedMonths[m].income, 0);
    const totalYearExpense = months.reduce((s, m) => s + closedMonths[m].expense, 0);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6"><TrendingUp size={32} /></div>
            <p className="text-sm font-black text-slate-400 mb-2 uppercase tracking-widest">إجمالي دخل عام 2024</p>
            <h4 className="text-4xl font-black text-slate-900">{totalYearIncome.toLocaleString()} <span className="text-sm">ج.م</span></h4>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-6"><TrendingDown size={32} /></div>
            <p className="text-sm font-black text-slate-400 mb-2 uppercase tracking-widest">إجمالي مصروفات عام 2024</p>
            <h4 className="text-4xl font-black text-slate-900">{totalYearExpense.toLocaleString()} <span className="text-sm">ج.م</span></h4>
          </div>
          <div className={`p-8 rounded-[2.5rem] border shadow-xl flex flex-col items-center text-center ${totalYearIncome - totalYearExpense >= 0 ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6"><ArrowUpRight size={32} /></div>
            <p className="text-sm font-black opacity-80 mb-2 uppercase tracking-widest">صافي الربح السنوي المحدث</p>
            <h4 className="text-4xl font-black">{(totalYearIncome - totalYearExpense).toLocaleString()} <span className="text-sm font-bold">ج.م</span></h4>
          </div>
        </div>

        <Card className="border-none shadow-xl shadow-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black"><BarChart3 size={20} className="text-indigo-600" /> ملخص الأداء الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {months.map(month => (
                <div key={month} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-center hover:border-indigo-400 transition-all group">
                  <p className="text-xs font-black text-slate-400 mb-2">{new Date(month + '-01').toLocaleDateString('ar-EG', { month: 'long' })}</p>
                  <p className="text-lg font-black text-slate-900 mb-3">{(closedMonths[month].net).toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">Net</span></p>
                  <div className="flex justify-center gap-1">
                    <span className="w-1.5 h-6 bg-indigo-300 rounded-full"></span>
                    <span className={`w-1.5 h-10 ${closedMonths[month].net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full`}></span>
                    <span className="w-1.5 h-8 bg-slate-200 rounded-full"></span>
                  </div>
                </div>
              ))}
              {/* Placeholder for current/future months */}
              <div className="p-6 bg-white border-2 border-dashed border-slate-100 rounded-[2rem] flex items-center justify-center opacity-40">
                <Calendar size={24} className="text-slate-200" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-10 font-['Cairo'] text-right pb-32">
      {/* View Tabs */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-6 sticky top-2 z-40 backdrop-blur-md bg-white/80">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          {[
            { id: 'daily', label: 'التقرير اليومي', icon: Calendar },
            { id: 'monthly', label: 'التقرير الشهري', icon: BarChart3 },
            { id: 'annual', label: 'التقرير السنوي', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {activeTab === 'daily' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-slate-600 font-bold text-sm">
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))} className="hover:text-indigo-600"><ChevronRight size={18} /></button>
              <span className="px-4 min-w-[150px] text-center">{currentDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))} className="hover:text-indigo-600"><ChevronLeft size={18} /></button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'daily' ? renderDaily() : activeTab === 'monthly' ? renderMonthly() : renderAnnual()}

      {/* Petty Cash Modal */}
      {showPettyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-black">{showPettyModal === 'add' ? 'إضافة عهدة جديدة' : 'سحب من العهدة'}</CardTitle>
              <button onClick={() => setShowPettyModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 mr-2">مبلغ العهدة (ج.م)</label>
                <Input
                  type="number"
                  autoFocus
                  value={pettyActionValue}
                  onChange={(e) => setPettyActionValue(e.target.value)}
                  placeholder="0.00"
                  className="text-2xl font-black h-16 text-center border-2 border-slate-100 focus:border-indigo-500 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 mr-2">ملاحظات البند</label>
                <Input
                  value={pettyNote}
                  onChange={(e) => setPettyNote(e.target.value)}
                  placeholder="مثلاً: شراء أدوات مكتبية، سلفة موظف..."
                  className="h-12 font-bold border-2 border-slate-100 focus:border-indigo-500 rounded-xl"
                />
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs font-bold text-slate-500 leading-relaxed">
                {showPettyModal === 'add' ? 'سيتم إضافة هذا المبلغ إلى إجمالي دخل الشهر الحالي بصفته "عهدة داخلة".' : 'سيتم احتساب هذا المبلغ كمصروفات إضافية لهذا الشهر بصفته "عهدة منصرفة".'}
              </div>
              <Button onClick={handlePettyAction} className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-lg shadow-indigo-100">
                تأكيد العملية
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Month Closing Modal */}
      {showCloseMonthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className="w-full max-w-lg border-none shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-indigo-50 shadow-inner"><Lock size={40} /></div>
              <CardTitle className="text-2xl font-black">تقفيل الشهر المالي ({viewDate.toLocaleDateString('ar-EG', { month: 'long' })})</CardTitle>
              <p className="text-slate-500 font-bold leading-relaxed px-4">أنت على وشك تقفيل الحسابات لهذا الشهر وترحيلها للتقرير السنوي. يرجى اختيار مصير مبلغ العهدة المتبقي:</p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRolloverOption('rollover')}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${rolloverOption === 'rollover' ? 'border-indigo-600 bg-indigo-50/50 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <Calendar className={rolloverOption === 'rollover' ? 'text-indigo-600' : 'text-slate-400'} size={24} />
                  <span className="font-black text-sm">ترحيل للشهر القادم</span>
                </button>
                <button
                  onClick={() => setRolloverOption('settle')}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${rolloverOption === 'settle' ? 'border-indigo-600 bg-indigo-50/50 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <CheckCircle2 className={rolloverOption === 'settle' ? 'text-indigo-600' : 'text-slate-400'} size={24} />
                  <span className="font-black text-sm">تسوية وتصفير العهدة</span>
                </button>
              </div>

              <div className="flex gap-4 pt-4">
                <Button onClick={() => setShowCloseMonthModal(false)} variant="ghost" className="flex-1 h-14 rounded-2xl font-black text-slate-400">إلغاء</Button>
                <Button onClick={handleCloseMonth} className="flex-2 h-14 px-10 rounded-2xl bg-slate-900 text-white font-black text-lg">تقفيل وترحيل البيانات</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

