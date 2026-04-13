
import React, { useState, useEffect } from 'react';
import { Receipt, Sparkles, ShoppingBag, CheckCircle2, DollarSign, Phone, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui';

interface FinalReceiptModalProps {
  bill: any;
  onClose: () => void;
  companyName?: string;
}

export const FinalReceiptModal = ({ bill, onClose, companyName }: FinalReceiptModalProps) => {
    const [sub, setSub] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (bill.payment_method === 'subscription' && bill.customer_id) {
            const fetchSub = async () => {
                setLoading(true);
                const { data } = await (supabase as any)
                    .from('subscriptions')
                    .select('*')
                    .eq('customer_id', bill.customer_id)
                    .in('status', ['Active', 'Exhausted'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data) setSub(data);
                setLoading(false);
            };
            fetchSub();
        }
    }, [bill]);

    return (
        <div className="space-y-8 text-right p-2 font-['Cairo']">
            {/* Header section */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-8">
              <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                <Receipt size={32} />
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-black text-slate-900 leading-tight">فاتورة الزيارة</h2>
                <p className="text-indigo-600 text-[10px] font-black tracking-widest mt-1 uppercase">Cloud Session Receipt</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-50/50 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                
                {/* Client Info Section */}
                <div className="border-b-2 border-dashed border-slate-200 pb-6 text-center">
                  <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest">مرحباً بك مجدداً</p>
                  <p className="text-3xl font-black text-slate-900">{bill.customers?.full_name || 'زائر متميز'}</p>
                  <p className="text-lg font-black text-indigo-600 bg-white inline-block px-5 py-1.5 rounded-2xl shadow-sm border border-indigo-50 mt-4 font-mono">{bill.user_code}</p>
                </div>

                <div className="space-y-4 font-bold text-slate-600">
                  <div className="flex justify-between items-center bg-white/70 p-5 rounded-2xl border border-white shadow-sm">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">وقت الاستخدام</span>
                    <span className="text-slate-900 font-black text-lg">
                       <span className="text-indigo-600">{Math.floor((bill.total_minutes || 0) / 60)}</span>h <span className="text-indigo-600">{Number(bill.total_minutes || 0) % 60}</span>m
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/70 p-5 rounded-2xl border border-white shadow-sm text-right">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تكلفة الجلسة</span>
                    <span className={`font-black text-lg ${bill.payment_method === 'subscription' && (Number(bill.total_amount || 0) - Number(bill.catering_amount || 0)) === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                       {bill.payment_method === 'subscription' && (Number(bill.total_amount || 0) - Number(bill.catering_amount || 0)) === 0 ? '✓ مخصوم من الاشتراك' : `${Number(bill.total_amount || 0) - (Number(bill.catering_amount) || 0)} EGP`}
                    </span>
                  </div>

                  {bill.payment_method === 'subscription' && (
                    <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px] animate-pulse" />
                      <div className="flex justify-between items-center relative z-10">
                        <div className="text-left">
                          <p className="text-3xl font-black text-white">{loading ? '...' : sub ? (sub.total_hours - sub.used_hours).toFixed(1) : '0.0'} <span className="text-[10px] opacity-40 uppercase tracking-widest ml-1">H Left</span></p>
                          <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {sub ? new Date(sub.end_date).toLocaleDateString('ar-EG') : '...'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Subscription</p>
                            <Sparkles size={12} className="text-amber-400" />
                          </div>
                          <p className="text-sm font-black whitespace-nowrap">{(Number(bill.total_minutes || 0) / 60).toFixed(2)}h consumed</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center bg-white/70 p-5 rounded-2xl border border-white shadow-sm">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">رصيد الكافيتريا</span>
                    <span className="text-slate-900 font-black text-lg">{bill.catering_amount || 0} <span className="text-xs opacity-30">EGP</span></span>
                  </div>
                </div>

                {bill.orders && bill.orders.length > 0 && (
                  <div className="mt-10 pt-8 border-t-2 border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.3em] text-center">أصناف الضيافة</p>
                    <div className="space-y-3">
                      {bill.orders.map((o: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-black bg-white/80 backdrop-blur-sm rounded-[1.25rem] p-4 border border-white shadow-sm gap-4 group/item hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            {o.image_url ? (
                              <img src={o.image_url} className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100" alt="" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
                                    <ShoppingBag size={18} />
                                </div>
                            )}
                            <div className="text-right">
                                <span className="text-slate-800 text-sm block">{o.name}</span>
                                <span className="text-indigo-400 text-[10px] uppercase">Quantity x{o.quantity}</span>
                            </div>
                          </div>
                          <span className="text-slate-900 font-mono text-base">{o.price} <span className="text-[8px] opacity-30">EGP</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-10 mt-6 border-t border-slate-200 flex flex-col items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">{companyName ? 'عضوية شركة' : 'المبلغ المستحق للدفع'}</span>
                  <div className="relative">
                    <div className="absolute inset-x-0 bottom-1 h-3 bg-emerald-500/10 -rotate-1 rounded-full blur-[2px]" />
                    <p className="text-6xl font-black text-emerald-600 relative z-10 italic">
                      {companyName ? 'Cloud' : bill.total_amount}
                      <span className="text-xl opacity-30 ml-3 not-italic">{companyName ? 'Business' : 'EGP'}</span>
                    </p>
                  </div>
                  {companyName && (
                    <p className="text-xs font-bold text-indigo-500 mt-2 bg-indigo-500/5 px-4 py-2 rounded-lg border border-indigo-500/10">
                      سيتم تحصيل المبلغ من حساب شركة {companyName}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={onClose}
                    className="group relative flex flex-col items-center justify-center py-6 bg-slate-900 text-white font-black rounded-[2.5rem] shadow-xl hover:bg-black hover:-translate-y-1 active:scale-95 transition-all text-sm overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <DollarSign size={24} className="mb-2 text-emerald-400" />
                    دفع كاش
                  </button>
                  <button
                    onClick={() => {
                        const amount = bill.total_amount;
                        const ussdCode = `*9*7*01007480906*${amount}#`;
                        if (confirm(`تحويل فودافون كاش (${amount} ج.م)؟\nسيتم فتح لوحة الاتصال بالكود المباشر.`)) {
                           window.location.href = `tel:${ussdCode.replace('#', '%23')}`;
                        }
                    }}
                    className="group relative flex flex-col items-center justify-center py-6 bg-rose-600 text-white font-black rounded-[2.5rem] shadow-xl hover:bg-rose-700 hover:-translate-y-1 active:scale-95 transition-all text-sm overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Phone size={24} className="mb-2 text-rose-200" />
                    فودافون كاش
                  </button>
                </div>

                <button
                  onClick={() => {
                      navigator.clipboard.writeText('01007480906');
                      alert('تم نسخ الرقم: 01007480906\nيمكنك الآن لصقه في InstaPay');
                      window.location.href = 'https://www.instapay.com.eg';
                  }}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 transition-all text-sm border border-indigo-100"
                >
                  <Smartphone size={18} />
                  <span>دفع بواسطة InstaPay</span>
                </button>
              </div>
            </div>
        </div>
    );
};
