import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Clock, AlertCircle, Plus, X, Save, Sun, Moon, CalendarDays } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

export const StaffManagement = ({ branchId }: { branchId?: string }) => {
  const [activeShift, setActiveShift] = useState<'day' | 'night'>('day');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [performance, setPerformance] = useState(0);

  const [newTask, setNewTask] = useState({
    name: '',
    time: '',
    recurrence: 'يومي',
    shift: 'day'
  });

  useEffect(() => {
    if (branchId) {
      fetchTasks();
      fetchAlerts();
      
      const channel = supabase.channel('staff_mgmt_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_tasks' }, () => fetchTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_alerts' }, () => fetchAlerts())
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, [branchId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('branch_tasks')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const tasksList = data || [];
      setTasks(tasksList);
      
      // Calculate real performance
      if (tasksList.length > 0) {
        const done = tasksList.filter((t: any) => t.status === 'done').length;
        setPerformance(Math.round((done / tasksList.length) * 100));
      } else {
        setPerformance(100);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const { data } = await (supabase as any)
        .from('branch_alerts')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setAlerts(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.name || !newTask.time || !branchId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('branch_tasks')
        .insert([{
          task_name: newTask.name,
          time: newTask.time,
          shift: newTask.shift,
          recurrence: newTask.recurrence,
          status: 'pending',
          branch_id: branchId
        }])
        .select();

      if (error) throw error;

      setTasks([...tasks, ...(data || [])]);
      setShowAddModal(false);
      setNewTask({ name: '', time: '', recurrence: 'يومي', shift: 'day' });
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';

    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

      const { error } = await (supabase as any)
        .from('branch_tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling task:', error);
      // Revert on error
      fetchTasks();
    }
  };

  const filteredTasks = tasks.filter(t => t.shift === activeShift);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right">
      {/* Shift Controls & Add Task Button */}
      <div className="flex flex-wrap justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveShift('day')}
            className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeShift === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Sun size={18} /> شيفت النهار
          </button>
          <button
            onClick={() => setActiveShift('night')}
            className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeShift === 'night' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Moon size={18} /> شيفت المساء
          </button>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl px-8 gap-2 font-black shadow-lg shadow-indigo-100"
        >
          <Plus size={20} /> إضافة مهمة تشتغيلية
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              {activeShift === 'day' ? <Sun className="text-amber-500" /> : <Moon className="text-indigo-600" />}
              مهام {activeShift === 'day' ? 'النهار' : 'المساء'} (SOPs)
            </h3>
            <span className="text-xs font-black text-slate-400 tracking-widest uppercase">اليوم، {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center p-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredTasks.length > 0 ? filteredTasks.map(task => (
              <div key={task.id} className={`p-6 rounded-3xl border transition-all flex items-center justify-between ${task.status === 'done' ? 'bg-slate-50 border-transparent opacity-60' : 'bg-white border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => toggleTask(task.id, task.status)}
                    className={`${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {task.status === 'done' ? <CheckSquare size={28} /> : <Square size={28} />}
                  </button>
                  <div>
                    <p className={`font-black ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.task_name}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{task.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-md">يتكرر: {task.recurrence}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300 font-black">
                لا توجد مهام مضافة لهذا الشيفت
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl border-none">
            <h4 className="font-black text-lg mb-4">أداء الموظفين اليوم</h4>
            <div className="space-y-6">
              <div className="flex justify-between text-xs font-bold opacity-80"><span>نسبة إنجاز المهام الكلية</span><span>{performance}%</span></div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: `${performance}%` }}></div></div>
              <p className="text-[11px] font-bold opacity-70 italic leading-relaxed">
                {performance >= 90 ? 'أداء ممتاز والتزام تام بجدول العمل.' : performance >= 70 ? 'أداء جيد، يرجى استكمال المهام المتبقية.' : 'يرجى التركيز على إنهاء المهام المطلوبة.'}
              </p>
            </div>
          </Card>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-500" />
              تنبيهات الفرع
            </h4>
            <div className="space-y-4">
              {alerts.length > 0 ? alerts.map(alert => (
                <div key={alert.id} className={`p-4 rounded-2xl border ${alert.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' : alert.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                  <p className="text-xs font-bold leading-relaxed">{alert.message}</p>
                </div>
              )) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-400">لا توجد تنبيهات حالية</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-black text-xl">إضافة مهمة جديدة</CardTitle>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 mr-2">وصف المهمة</label>
                <Input
                  autoFocus
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="مثلاً: جرد الخزينة المسائي"
                  className="h-12 font-bold border-2 border-slate-100 focus:border-indigo-500 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 mr-2">الموعد</label>
                  <Input
                    type="time"
                    value={newTask.time}
                    onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                    className="h-12 font-bold border-2 border-slate-100 focus:border-indigo-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 mr-2">الشيفت</label>
                  <select
                    value={newTask.shift}
                    onChange={(e) => setNewTask({ ...newTask, shift: e.target.value as any })}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 bg-white px-5 text-sm font-bold focus:border-indigo-500 outline-none transition-all rtl"
                  >
                    <option value="day">نهار</option>
                    <option value="night">مساء</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 mr-2">التكرار</label>
                <select
                  value={newTask.recurrence}
                  onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value })}
                  className="w-full h-12 rounded-xl border-2 border-slate-100 bg-white px-5 text-sm font-bold focus:border-indigo-500 outline-none transition-all rtl"
                >
                  <option value="يومي">يومي</option>
                  <option value="أسبوعي">أسبوعي</option>
                  <option value="شهري">شهري</option>
                </select>
              </div>

              <Button
                onClick={handleAddTask}
                className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-lg shadow-indigo-100 gap-2"
              >
                <Save size={20} /> تأكيد الإضافة
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
