
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Receipt, Trash2, Calendar, Tag, CreditCard, X, Save } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

const EXPENSE_CATEGORIES = [
  { id: 'Cleaning', label: 'تنظيف وتطهير' },
  { id: 'transportation', label: 'انتقالات ومواصلات' },
  { id: 'Kitchen', label: 'مطبخ وبوفيه' },
  { id: 'Maintenance', label: 'صيانة وإصلاحات' },
  { id: 'Utilities', label: 'مرافق (كهرباء/مياه/نت)' },
  { id: 'Office Supplies', label: 'أدوات مكتبية' },
  { id: 'Salaries', label: 'رواتب وأجور' },
  { id: 'Assets', label: 'أصول ومعدات' },
  { id: 'Marketing', label: 'تسويق وإعلانات' },
  { id: 'Rent', label: 'إيجار' },
  { id: 'Employee benefits', label: 'بدلات ومزايا موظفين' },
  { id: 'other', label: 'أخرى' },
];

export const ExpensesPanel = ({ branchId }: { branchId?: string }) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: EXPENSE_CATEGORIES[0].label,
    note: '',
    date: new Date().toISOString().split('T')[0],
    items: [] as { name: string, price: string, qty: string, unit: string }[]
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [branchId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let query = supabase.from('expenses').select('*').order('date', { ascending: false });
      if (branchId) query = query.eq('branch_id', branchId);
      
      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    const finalAmount = newExpense.items.length > 0
      ? newExpense.items.reduce((sum, item) => sum + (parseFloat(item.price || '0') * parseFloat(item.qty || '0')), 0)
      : parseFloat(newExpense.amount || '0');

    if (!finalAmount || !newExpense.category) return;
    setSubmitting(true);
    
    try {
        if (newExpense.category === 'مطبخ وبوفيه' && newExpense.items.length > 0) {
            for (const item of newExpense.items) {
                if (!item.name || parseFloat(item.qty) <= 0) continue;
                
                // Check if it exists in inventory
                const { data: existing } = await supabase
                    .from('inventory')
                    .select('id, stock')
                    .eq('name', item.name)
                    .eq('category', 'مطبخ وبوفيه')
                    .maybeSingle();
                    
                if (existing) {
                    await supabase
                        .from('inventory')
                        .update({ 
                            stock: (existing.stock || 0) + parseFloat(item.qty), 
                            last_restock: newExpense.date,
                            price: parseFloat(item.price) // Assume selling price is input here or calculated
                        })
                        .eq('id', existing.id);
                        
                    // Update/Create in shop_products
                    await (supabase as any)
                        .from('shop_products')
                        .upsert({
                            inventory_id: existing.id,
                            name: item.name,
                            price: parseFloat(item.price) * 1.5, // 50% profit margin as default
                            branch_id: branchId || null,
                            is_available: true
                        }, { onConflict: 'inventory_id' });

                    await supabase.from('inventory_logs').insert([{
                        branch_id: branchId || null,
                        inventory_id: existing.id,
                        type: 'Supply',
                        quantity: parseFloat(item.qty),
                        notes: newExpense.note
                    }]);
                } else {
                    const { data: newInv } = await supabase
                        .from('inventory').insert([{
                            name: item.name,
                            category: 'مطبخ وبوفيه',
                            stock: parseFloat(item.qty),
                            price: parseFloat(item.price), 
                            min_stock: 5,
                            unit: item.unit,
                            last_restock: newExpense.date,
                            branch_id: branchId || null
                        }]).select().single();
                        
                    if (newInv) {
                        // Create in shop_products
                        await (supabase as any)
                            .from('shop_products')
                            .upsert({
                                inventory_id: (newInv as any).id,
                                name: item.name,
                                price: parseFloat(item.price) * 1.5,
                                branch_id: branchId || null,
                                is_available: true
                            }, { onConflict: 'inventory_id' });

                        await supabase.from('inventory_logs').insert([{
                            branch_id: branchId || null,
                            inventory_id: (newInv as any).id,
                            type: 'Supply',
                            quantity: parseFloat(item.qty),
                            notes: newExpense.note
                        }]);
                    }
                }
            }
        }

        const expenseRecord = {
          category: newExpense.category,
          amount: finalAmount,
          date: newExpense.date,
          note: newExpense.note + (newExpense.items.length > 0 ? ` (${newExpense.items.length} أصناف)` : ''),
          type: 'General',
          items: newExpense.items.length > 0 ? newExpense.items : null,
          branch_id: branchId || null
        };

        const { error } = await supabase.from('expenses').insert([expenseRecord]);
        if (error) throw error;

        setShowAddModal(false);
        setNewExpense({
          amount: '',
          category: EXPENSE_CATEGORIES[0].label,
          note: '',
          date: new Date().toISOString().split('T')[0],
          items: []
        });
        
        fetchExpenses();
    } catch (err: any) {
        alert('حدث خطأ أثناء حفظ المصروف: ' + err.message);
    } finally {
        setSubmitting(false);
    }
  };
  
  const handleDeleteExpense = async (id: string) => {
      if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
      try {
          const { error } = await supabase.from('expenses').delete().eq('id', id);
          if (error) throw error;
          fetchExpenses();
      } catch (err: any) {
          alert("خطأ أثناء الحذف: " + err.message);
      }
  };

  const addItemRow = () => {
    setNewExpense({
      ...newExpense,
      items: [...newExpense.items, { name: '', price: '', qty: '1', unit: 'قطعة' }]
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...newExpense.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setNewExpense({ ...newExpense, items: newItems });
  };

  const removeItem = (index: number) => {
    setNewExpense({
      ...newExpense,
      items: newExpense.items.filter((_, i) => i !== index)
    });
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right">
      {/* Action Header */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-6">
        <div className="flex gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Plus size={18} /> إضافة مصروف جديد
          </button>
          <button className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all flex items-center gap-2">
            <Filter size={18} /> تصنيف
          </button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="البحث في المصروفات..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Statistics Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">إجمالي مصروفات الشهر</p>
            <h3 className="text-3xl font-black text-rose-600">{totalExpenses.toLocaleString()} <span className="text-xs">EGP</span></h3>
          </div>
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
            <h4 className="font-black mb-6 flex items-center gap-2 text-indigo-400"><Tag size={18} /> التوزيع المالي</h4>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="opacity-60">ثابتة (إيجار/فواتير)</span>
                <span className="font-black">65%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: '65%' }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-60">متغيرة (مشتريات)</span>
                <span className="font-black">20%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '20%' }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-60">أخرى</span>
                <span className="font-black">15%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-6">البند / الفئة</th>
                <th className="px-6 py-6">التاريخ</th>
                <th className="px-6 py-6">الملاحظات</th>
                <th className="px-6 py-6 text-center">المبلغ</th>
                <th className="px-8 py-6 text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {expenses.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all text-slate-500"><Receipt size={16} /></div>
                      <div>
                        <p className="text-slate-800">{item.category}</p>
                        <span className="text-[10px] font-black text-indigo-500 uppercase">{item.type}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-slate-400 text-xs">
                    <div className="flex items-center gap-2"><Calendar size={12} /> {item.date}</div>
                  </td>
                  <td className="px-6 py-6 text-slate-500 text-xs max-w-xs truncate">{item.note}</td>
                  <td className="px-6 py-6 text-center text-rose-600 font-black">{item.amount?.toLocaleString() || 0} <span className="text-[10px]">EGP</span></td>
                  <td className="px-8 py-6 text-left">
                    <button onClick={() => handleDeleteExpense(item.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold">لا توجد مصروفات مسجلة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className={`w-full ${newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية' ? 'max-w-2xl' : 'max-w-md'} border-none shadow-2xl animate-in zoom-in-95 duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-black text-xl">إضافة مصروف جديد</CardTitle>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-right">
                  <label className="text-xs font-black text-slate-500 mr-2">فئة المصروف</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setNewExpense({
                        ...newExpense,
                        category: cat,
                        items: (cat === 'مطبخ وبوفيه' || cat === 'أدوات مكتبية') ? (newExpense.items.length === 0 ? [{ name: '', price: '', qty: '1', unit: 'قطعة' }] : newExpense.items) : []
                      });
                    }}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 bg-white px-5 text-sm font-bold focus:border-indigo-500 outline-none transition-all rtl"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.label}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 mr-2">التاريخ</label>
                  <Input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="h-12 font-bold border-2 border-slate-100 focus:border-indigo-500 rounded-xl"
                  />
                </div>
              </div>

              {(newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية') ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="font-black text-slate-700">تفاصيل الأصناف</span>
                    <button
                      onClick={addItemRow}
                      className="text-xs font-black bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-1"
                    >
                      <Plus size={14} /> إضافة صنف
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newExpense.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end animate-in slide-in-from-top-2 duration-300">
                        <div className="col-span-4">
                          <label className="text-[10px] font-black text-slate-400 mr-2">إسم الصنف</label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                            placeholder="مثلا: سكر"
                            className="h-10 text-xs font-bold border-2 border-slate-100 rounded-lg"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 mr-2">السعر</label>
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(idx, 'price', e.target.value)}
                            placeholder="0"
                            className="h-10 text-xs font-bold border-2 border-slate-100 rounded-lg text-center"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 mr-2">الكمية</label>
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                            className="h-10 text-xs font-bold border-2 border-slate-100 rounded-lg text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-black text-slate-400 mr-2">الوحدة</label>
                          <select
                            value={item.unit}
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                            className="w-full h-10 rounded-lg border-2 border-slate-100 bg-white px-2 text-[10px] font-bold outline-none"
                          >
                            <option>قطعة</option>
                            <option>كيلو</option>
                            <option>كرتونة</option>
                            <option>علبة</option>
                            <option>لتر</option>
                          </select>
                        </div>
                        <div className="col-span-1 flex justify-center pb-1">
                          <button onClick={() => removeItem(idx)} className="text-rose-400 hover:text-rose-600 p-2"><X size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-indigo-50 p-6 rounded-2xl flex justify-between items-center border border-indigo-100">
                    <span className="font-black text-indigo-900">الإجمالي المحسوب:</span>
                    <span className="text-xl font-black text-indigo-600">
                      {newExpense.items.reduce((s, i) => s + (parseFloat(i.price || '0') * parseFloat(i.qty || '0')), 0).toLocaleString()} EGP
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 mr-2">المبلغ (EGP)</label>
                  <Input
                    type="number"
                    autoFocus
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    placeholder="0.00"
                    className="text-2xl font-black h-16 text-center border-2 border-slate-100 focus:border-indigo-500 rounded-2xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 mr-2">الملاحظات</label>
                <Input
                  value={newExpense.note}
                  onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
                  placeholder="أدخل تفاصيل المصروف..."
                  className="h-12 font-bold border-2 border-slate-100 focus:border-indigo-500 rounded-xl"
                />
              </div>

              <Button
                onClick={handleAddExpense}
                disabled={submitting}
                className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-lg shadow-indigo-100 gap-2 disabled:opacity-50"
              >
                <Save size={20} /> {submitting ? 'جاري المعالجة...' : 'تأكيد الإضافة'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
