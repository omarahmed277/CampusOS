import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, RefreshCw, X, Receipt, Users2, Sparkles, Plus, Lock, Briefcase, Layout, DollarSign, Phone, Printer, Smartphone } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { calculateSessionPrice } from '../lib/pricing';
import { Modal } from '../components/ui';

interface Session {
  id: string;
  customer_id: string;
  user_code: string;
  phone_number: string;
  start_time: string;
  end_time?: string;
  status: string;
  catering_amount: number;
  orders: any[];
  customers?: { full_name: string };
  services?: { code: string; name_ar: string; color?: string };
}

export const WorkspaceAdminSessions = ({ branchId }: { branchId?: string }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [checkoutBill, setCheckoutBill] = useState<any>(null);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [manualCode, setManualCode] = useState('');
  const [startingSession, setStartingSession] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [pointsPerHour, setPointsPerHour] = useState(10);
  const [studentCashbackPct, setStudentCashbackPct] = useState(15);
  const [renewalPkgId, setRenewalPkgId] = useState<number | null>(null);
  const [renewalPrice, setRenewalPrice] = useState(0);
  const [renewalPaid, setRenewalPaid] = useState(0);
  const [partnerCode, setPartnerCode] = useState('');
  const [activePartner, setActivePartner] = useState<any>(null);
  const [isVerifyingPartner, setIsVerifyingPartner] = useState(false);

  const SUBSCRIPTION_PACKAGES = [
    { id: 1, name: '40 Hours', hours: 40, price: 320 },
    { id: 2, name: '80 Hours', hours: 80, price: 600 },
    { id: 3, name: '100 Hours', hours: 100, price: 700 },
  ];

  // Helper to format UTC ISO to Cairo Local YYYY-MM-DDTHH:mm
  const handleVerifyPartner = async () => {
    if (!partnerCode) return;
    setIsVerifyingPartner(true);
    try {
        const { data, error } = await supabase
            .from('partners')
            .select('*')
            .eq('partner_code', partnerCode.trim().toUpperCase())
            .eq('is_active', true)
            .maybeSingle();
        
        if (error) throw error;
        if (data) {
            setActivePartner(data);
        } else {
            setActivePartner(null);
            alert('كود غير صحيح أو نشاط غير مفعل');
        }
    } catch (err) {
        console.error(err);
    } finally {
        setIsVerifyingPartner(false);
    }
  };

  const toCairoInput = (iso?: string | Date) => {
    if (!iso) return '';
    try {
      const date = typeof iso === 'string' ? new Date(iso) : iso;
      // 'sv-SE' gives YYYY-MM-DD HH:mm:ss format
      return date.toLocaleString('sv-SE', { timeZone: 'Africa/Cairo' }).replace(' ', 'T').slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  // Helper to convert local input back to UTC ISO
  const fromCairoInput = (localStr: string) => {
    if (!localStr) return null;
    return new Date(localStr).toISOString();
  };

  useEffect(() => {
    if (editingBill) {
      handleUpdateTime('endTime', (toCairoInput as any)(editingBill.endTime));
    }
  }, [renewalPkgId]);

  useEffect(() => {
    if (!branchId) return;
    
    fetchSessions();
    fetchInventory();
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // UI update every minute

    const channel = supabase
      .channel(`workspace_admin_sessions_${branchId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'workspace_sessions'
          // Removed specific filter to handle JS-side filtering for robustness
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          const eventType = payload.eventType;
          
          // Only refresh if the change belongs to our branch or was moved out of it
          if (newData?.branch_id === branchId || oldData?.branch_id === branchId) {
            if (eventType === 'UPDATE') {
                setSessions(prev => prev.map(session => 
                    session.id === newData.id ? { ...session, ...newData } : session
                ));
                // Optional: still fetch to ensure all joins (like customers) are fresh, 
                // but state is updated immediately for status/pause flags
                fetchSessions();
            } else {
              fetchSessions();
            }
          }
        }
      )
      .on('broadcast', { event: 'session_updated' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  useEffect(() => {
    const fetchPointsPerHour = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['points_per_hour', 'student_cashback_percentage']);
      if (data) {
        const pph = data.find(s => s.key === 'points_per_hour')?.value;
        const scb = data.find(s => s.key === 'student_cashback_percentage')?.value;
        if (pph) setPointsPerHour(Number(pph));
        if (scb) setStudentCashbackPct(Number(scb));
      }
    };
    fetchPointsPerHour();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('workspace_sessions')
        .select(`*, services(code, name_ar, color), partners(*), customers(full_name, loyalty_points, cashback_balance, college, company_members(*, companies(*)), subscriptions(*))`)
        .eq('branch_id', branchId || '')
        .in('status', ['active', 'checkout_requested', 'pause_requested', 'paused', 'resume_requested'])
        .order('start_time', { ascending: false });

      if (error) throw error;
      
      const sorted = (data as any[]).sort((a, b) => {
        const isReqA = ['checkout_requested', 'pause_requested', 'resume_requested'].includes(a.status);
        const isReqB = ['checkout_requested', 'pause_requested', 'resume_requested'].includes(b.status);
        if (isReqA && !isReqB) return -1;
        if (!isReqA && isReqB) return 1;
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      });
      
      setSessions(sorted);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePause = async (session: any) => {
    try {
        const { error } = await (supabase as any)
          .from('workspace_sessions')
          .update({ 
              status: 'paused',
              is_paused: true,
              last_pause_start: new Date().toISOString()
          })
          .eq('id', session.id);
        
        if (error) throw error;
        fetchSessions();
    } catch (err: any) {
        alert("Error pausing session: " + err.message);
    }
  };

  const handleManualPause = async (session: any) => {
    if (!confirm('هل تريد إيقاف الوقت لهذه الجلسة يدوياً؟')) return;
    handleApprovePause(session);
  };

  const handleApproveResume = async (session: any) => {
    try {
        const now = new Date();
        const pauseStart = new Date(session.last_pause_start);
        const diffMins = Math.max(0, (now.getTime() - pauseStart.getTime()) / 60000);
        const newTotalPaused = (Number(session.total_paused_minutes) || 0) + diffMins;

        const { error } = await (supabase as any)
          .from('workspace_sessions')
          .update({ 
              status: 'active',
              is_paused: false,
              last_pause_start: null,
              total_paused_minutes: newTotalPaused
          })
          .eq('id', session.id);
        
        if (error) throw error;
        fetchSessions();
    } catch (err: any) {
        alert("Error resuming session: " + err.message);
    }
  };

  const fetchInventory = async () => {
    if (!branchId) return;
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branchId)
        .gt('stock', 0);
      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

    const handlePrintReceipt = () => {
        const receiptContent = document.getElementById(`printable-receipt`);
        if (!receiptContent) return;
        const iframe = document.createElement(`iframe`);
        iframe.style.display = `none`;
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;
        const styles = Array.from(document.querySelectorAll(`style, link[rel="stylesheet"]`)).map(s => s.outerHTML).join(``);
        iframeDoc.open();
        iframeDoc.write(`<html><head><title>Receipt</title>${styles}<style>body { margin: 0; padding: 0; background: white; } #printable-receipt { display: block !important; visibility: visible !important; width: 80mm !important; padding: 8mm !important; margin: 0 !important; font-family: "Cairo", sans-serif; direction: rtl; } #printable-receipt * { height: auto !important; visibility: visible !important; }</style></head><body dir="rtl"><div id="printable-receipt">${receiptContent.innerHTML}</div></body></html>`);
        iframeDoc.close();
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => { document.body.removeChild(iframe); }, 1000);
        }, 500);
    };

  const handlePrepareCheckout = (session: Session | any) => {
    const endTime = (session.status === 'checkout_requested' && session.end_time) 
      ? new Date(session.end_time) 
      : new Date();
    const startTime = new Date(session.start_time);
    const totalPausedMins = Number(session.total_paused_minutes) || 0;
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000) - totalPausedMins);
    const usedHours = parseFloat((diffMinutes / 60).toFixed(2));

    // Check for Active Subscription
    const activeSub = session.customers?.subscriptions?.find((s: any) => 
        s.status === 'Active' && 
        new Date(s.end_date) >= new Date() &&
        s.used_hours < s.total_hours
    );

    let workspaceAmount = 0;
    let isSubscribed = false;
    let remainingSubHours = 0;
    let overageHours = 0;
    const businessMember = session.customers?.company_members?.[0]; // Get linked business member
    const businessContract = session.customers?.contracts;

    if (activeSub) {
        isSubscribed = true;
        const availableHours = Number(activeSub.total_hours) - Number(activeSub.used_hours);
        const rawRemaining = availableHours - usedHours;

        if (rawRemaining < 0) {
            overageHours = Math.abs(rawRemaining);
            remainingSubHours = 0;
            const overageMins = Math.ceil(overageHours * 60);
            workspaceAmount = calculateSessionPrice(overageMins) || 0;
        } else {
            remainingSubHours = rawRemaining;
            workspaceAmount = 0; 
        }
    } else if (businessMember) {
        // Business logic: Space is logged but not paid now.
        workspaceAmount = 0; 
    } else if (session.user_code === 'GUEST_KITCHEN') {
        workspaceAmount = 0;
    } else {
        workspaceAmount = calculateSessionPrice(diffMinutes) || 0;
    }
    
    const orders = Array.isArray(session.orders) ? [...session.orders] : [];
    const actualCateringCost = orders.reduce((sum, o) => sum + ((Number(o.price) || 0) * (Number(o.quantity) || 1)), 0);
    
    // If it's a business member, the catering is deducted from their balance, space is logged.
    // So the "At Counter" amount becomes 0 if both are business-covered.
    const isBusiness = !!businessMember;
    const cateringAmount = isBusiness ? 0 : actualCateringCost;
    const totalAmount = isBusiness ? 0 : Math.max(0, parseFloat(((Number(workspaceAmount) || 0) + (Number(cateringAmount) || 0)).toFixed(2)));

    setEditingBill({
      ...session,
      orders,
      workspaceAmount: workspaceAmount,
       cateringAmount,
      actualCateringCost,
      totalAmount,
      diffMinutes,
      usedHours,
      startTime: session.start_time,
      endTime: endTime.toISOString(),
      isSubscribed,
      subscriptionId: activeSub?.id,
      remainingSubHours: remainingSubHours,
      initialRemaining: isSubscribed ? (Number(activeSub.total_hours) - Number(activeSub.used_hours)) : 0,
      realOverage: overageHours,
      subEndDate: activeSub?.end_date,
      customerId: session.customer_id,
      cashbackBalance: session.customers?.cashback_balance || 0,
      loyaltyPoints: session.customers?.loyalty_points || 0,
      deductedCashback: 0,
      contract: businessContract,
      partners: session.partners
    });
  };

  const handleUpdateTime = (field: 'startTime' | 'endTime', value: string) => {
    if (!editingBill) return;
    
    const startTime = field === 'startTime' ? fromCairoInput(value) : editingBill.startTime;
    const endTime = field === 'endTime' ? fromCairoInput(value) : editingBill.endTime;
    
    if (!startTime || !endTime) return;

    const totalPausedMins = Number(editingBill.total_paused_minutes) || 0;
    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000) - totalPausedMins);
    const usedHours = parseFloat((diffMinutes / 60).toFixed(2));

    let workspaceAmount = 0;
    let remainingSubHours = 0;
    const businessContract = editingBill.contract;

    if (editingBill.isSubscribed) {
       const rawRemaining = Number(editingBill.initialRemaining) - usedHours;
       if (rawRemaining < 0) {
           const overageHours = Math.abs(rawRemaining);
           remainingSubHours = 0;
           workspaceAmount = calculateSessionPrice(Math.ceil(overageHours * 60)) || 0;
       } else {
           remainingSubHours = rawRemaining;
           workspaceAmount = 0;
       }
    } else if (businessContract && businessContract.type === 'Business') {
       workspaceAmount = (usedHours * (Number(businessContract.space_price) || 0));
    } else if (editingBill.user_code === 'GUEST_KITCHEN') {
       workspaceAmount = 0;
    } else {
       workspaceAmount = calculateSessionPrice(diffMinutes) || 0;
    }

    const actualCateringCost = (Number(editingBill.actualCateringCost) || 0);
    const cateringAmount = (businessContract && businessContract.type === 'Business') ? 0 : actualCateringCost;
    const deductedCashback = Number(editingBill.deductedCashback) || 0;
    // If renewal is selected, workspaceAmount (overage) is covered by the new subscription
    const finalWorkspaceAmount = renewalPkgId ? 0 : workspaceAmount;
    const totalAmount = Math.max(0, parseFloat((Number(finalWorkspaceAmount) + cateringAmount - deductedCashback).toFixed(2)));

    setEditingBill({
       ...editingBill,
       startTime,
       endTime,
       diffMinutes,
       usedHours,
       workspaceAmount: workspaceAmount,
       cateringAmount,
       actualCateringCost,
       totalAmount,
       remainingSubHours,
       realOverage: (Number(editingBill.initialRemaining) - usedHours < 0) ? Math.abs(Number(editingBill.initialRemaining) - usedHours) : 0
    });
  };

  const handleUpdateBillItem = (index: number, field: string, value: any) => {
    if (!editingBill) return;
    const newOrders = [...editingBill.orders];
    newOrders[index] = { ...newOrders[index], [field]: value };
    
    const actualCateringCost = newOrders.reduce((sum, o) => sum + ((Number(o.price) || 0) * (Number(o.quantity) || 1)), 0);
    const businessContract = editingBill.contract;
    const cateringAmount = (businessContract && businessContract.type === 'Business') ? 0 : actualCateringCost;
    const totalAmount = Math.max(0, parseFloat(((Number(editingBill.workspaceAmount) || 0) + cateringAmount - (Number(editingBill.deductedCashback) || 0)).toFixed(2)));
    
    setEditingBill({
      ...editingBill,
      orders: newOrders,
      cateringAmount,
      actualCateringCost,
      totalAmount
    });
  };

  const handleRemoveBillItem = (index: number) => {
    if (!editingBill) return;
    const newOrders = editingBill.orders.filter((_: any, i: number) => i !== index);
    const newCateringAmount = newOrders.reduce((sum, o) => sum + ((Number(o.price) || 0) * (Number(o.quantity) || 1)), 0);
    const newTotalAmount = parseFloat(((Number(editingBill.workspaceAmount) || 0) + newCateringAmount).toFixed(2));
    
    setEditingBill({
      ...editingBill,
      orders: newOrders,
      cateringAmount: newCateringAmount,
      totalAmount: newTotalAmount
    });
  };

  const handleAddBillItem = () => {
    if (!editingBill) return;
    const newOrders = [...editingBill.orders, { name: 'صنف جديد', price: 0, quantity: 1, time: new Date().toISOString() }];
    setEditingBill({ ...editingBill, orders: newOrders });
  };

  
  const handleConvertPoints = async () => {
    if (!editingBill || !editingBill.customerId) return;
    try {
      const { data: cust, error: fetchErr } = await supabase
        .from('customers')
        .select('loyalty_points, cashback_balance')
        .eq('id', editingBill.customerId)
        .single();
      
      if (fetchErr) throw fetchErr;
      if (!cust || (cust.loyalty_points || 0) <= 0) {
        alert('لا يوجد نقاط كافية للتحويل');
        return;
      }

      // 10 Points = 1 EGP Rate
      const pointsToConvert = cust.loyalty_points;
      const cashbackOutput = Number((pointsToConvert * 0.25).toFixed(2));
      
      const { error: upErr } = await supabase
        .from('customers')
        .update({
          loyalty_points: 0,
          cashback_balance: (Number(cust.cashback_balance) || 0) + cashbackOutput
        })
        .eq('id', editingBill.customerId);

      if (upErr) throw upErr;

      // Update local state
      setEditingBill({
        ...editingBill,
        cashbackBalance: (Number(editingBill.cashbackBalance) || 0) + cashbackOutput
      });
      alert(`تم تحويل ${pointsToConvert} نقطة إلى ${cashbackOutput} ج.م رصيد كاش باك`);
    } catch (err) {
      console.error('Points conversion error:', err);
      alert('خطأ في تحويل النقاط');
    }
  };


  const updatePaymentMethod = async (sessionId: string, method: string) => {
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ payment_method: method })
        .eq('id', sessionId);
      if (error) throw error;
      
      // Update local state so UI reflects it (optional if modal closes immediately)
      if (checkoutBill && checkoutBill.id === sessionId) {
        setCheckoutBill({ ...checkoutBill, payment_method: method });
      }
    } catch (err) {
      console.error('Error updating payment method:', err);
    }
  };

  const handleAcceptCheckout = async () => {
    if (!editingBill) return;
    setLoading(true);
    try {
      if (!editingBill.id) throw new Error("Missing Session ID");

      // Determine payment method
      const busMember = editingBill.customers?.company_members?.[0];
      const isCorporate = !!busMember;
      const finalPaymentMethod = editingBill.isSubscribed ? 'subscription' : (isCorporate ? 'corporate' : 'cash');

      // 1. Update the session record first
      const { error: sessionError } = await supabase
        .from('workspace_sessions')
        .update({
          status: 'completed',
          start_time: editingBill.startTime,
          end_time: editingBill.endTime,
          total_minutes: Number(editingBill.diffMinutes) || 0,
          catering_amount: Number(editingBill.cateringAmount) || 0,
          orders: editingBill.orders || [],
          total_amount: Number(editingBill.totalAmount) || 0,
          payment_method: finalPaymentMethod,
          notes: editingBill.notes || ''
        })
        .eq('id', editingBill.id);

      if (sessionError) {
          console.error('Session Update Error:', sessionError);
          throw new Error(`Failed to update session: ${sessionError.message}`);
      }

      // 2. Adjust Subscription Balance if applicable
      if (editingBill.isSubscribed && editingBill.subscriptionId) {
          const { data: sub, error: subFetchError } = await supabase
              .from('subscriptions')
              .select('used_hours, total_hours')
              .eq('id', editingBill.subscriptionId)
              .single();
          
          if (subFetchError) {
              console.error('Subscription Fetch Error:', subFetchError);
          } else if (sub) {
              const newUsed = parseFloat((Number(sub.used_hours || 0) + (Number(editingBill.usedHours) || 0)).toFixed(2));
              const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({ 
                    used_hours: newUsed,
                    status: newUsed >= Number(sub.total_hours) ? 'Exhausted' : 'Active'
                })
                .eq('id', editingBill.subscriptionId);
              
              if (subUpdateError) console.error('Subscription Update Error:', subUpdateError);
          }

          // RENEWAL LOGIC: Create new subscription and deduct overage
          if (renewalPkgId) {
             const pkg = SUBSCRIPTION_PACKAGES.find(p => p.id === renewalPkgId);
             if (pkg) {
                const overage = Number(editingBill.realOverage) || 0;
                const { error: renewalError } = await (supabase as any).from('subscriptions').insert({
                   branch_id: branchId,
                   customer_id: editingBill.customerId,
                   type: `${pkg.hours} Hours Package (Renewal)`,
                   price: renewalPrice,
                   paid: renewalPaid,
                   remaining: Math.max(0, renewalPrice - renewalPaid),
                   start_date: new Date().toISOString().split('T')[0],
                   end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
                   total_hours: pkg.hours,
                   used_hours: overage,
                   status: overage >= pkg.hours ? 'Exhausted' : 'Active'
                });
                if (renewalError) console.error('Renewal Error:', renewalError);
                else {
                   setRenewalPkgId(null);
                }
             }
          }
      }

      // 4. Award Partner Cashback (Student Activity)
      const partnerToAward = editingBill.partners || activePartner;
      if (partnerToAward && (editingBill.workspaceAmount > 0)) {
         const roomAmount = Number(editingBill.workspaceAmount) || 0;
         const partnerCashback = Number(((roomAmount * (partnerToAward.cashback_rate || 0)) / 100).toFixed(2));
         
         if (partnerCashback > 0) {
            const { error: partErr } = await supabase
               .from('partners')
               .update({
                  total_earned: (Number(partnerToAward.total_earned) || 0) + partnerCashback
               } as any)
               .eq('id', partnerToAward.id);
            
            if (partErr) console.error('Partner Cashback Error:', partErr);
            
            // Link partner to session (if not already linked)
            if (!editingBill.partner_id) {
               await supabase.from('workspace_sessions').update({ partner_id: partnerToAward.id }).eq('id', editingBill.id);
            }
         }
      }

      // 5. Award Loyalty & Cashback & Handle Business Contract Balance
      if (editingBill.customerId) {
        const busMember = editingBill.customers?.company_members?.[0];

        // NEW Shared Monthly Billing logic
        if (busMember) {
            const currentMonth = new Date(editingBill.startTime).toISOString().slice(0, 7);
            
            // 1. Find the contract for this month
            const { data: contract } = await (supabase as any)
               .from('monthly_contracts')
               .select('*')
               .eq('company_id', busMember.company_id)
               .eq('month', currentMonth)
               .single();

            if (contract) {
               // 2. Log Space usage (Post-paid)
               await (supabase as any)
                  .from('space_sessions')
                  .insert({
                     company_id: busMember.company_id,
                     member_id: busMember.id,
                     contract_id: contract.id,
                     check_in: editingBill.startTime,
                     check_out: editingBill.endTime,
                     duration_hours: editingBill.usedHours,
                     total_price: editingBill.usedHours * (contract.space_hour_price || 0)
                  });

               // 3. Log Catering orders (Prepaid Shared)
               if (editingBill.orders?.length > 0) {
                  const cOrders = editingBill.orders.map((o: any) => ({
                     company_id: busMember.company_id,
                     member_id: busMember.id,
                     contract_id: contract.id,
                     item_name: o.name,
                     price: o.price,
                     quantity: o.quantity || 1
                  }));
                  await (supabase as any).from('catering_orders').insert(cOrders);
                  // The trigger trg_deduct_catering will update monthly_contracts balance
               }
            }
        }
        
        // Legacy Business Contract Deduction (Keep for compatibility if used elsewhere)
        else if (editingBill.contract?.type === 'Business' && editingBill.actualCateringCost > 0) {
            const currentBalance = Number(editingBill.contract.prepaid_balance) || 0;
            const newBalance = Math.max(0, currentBalance - editingBill.actualCateringCost);
            
            await supabase
                .from('contracts')
                .update({ prepaid_balance: newBalance } as any)
                .eq('id', editingBill.contract.id);
        }

        let prevConvertedMins = 0;
        const match = (editingBill.notes || '').match(/\|CONVERTED_MINS:(\d+)\|/);
        if (match) {
           prevConvertedMins = parseInt(match[1]);
        }
        const billableMinsForPoints = Math.max(0, Number(editingBill.diffMinutes || 0) - prevConvertedMins);
        const pointsToAward = Math.floor(billableMinsForPoints / (60 / pointsPerHour));
        
        // Student Cashback on the PAID amount (Total - Deducted Cashback)
        
        const paidAmount = Math.max(0, Number(editingBill.totalAmount) || 0);
        const cashbackToAward = (studentCashbackPct > 0) ? (paidAmount * (studentCashbackPct / 100)) : 0;

        const { data: currentCust } = await supabase
          .from('customers')
          .select('loyalty_points, cashback_balance')
          .eq('id', editingBill.customerId)
          .single() as any;
        
        if (currentCust) {
          const updates: any = { 
            loyalty_points: (Number(currentCust.loyalty_points) || 0) + pointsToAward,
            cashback_balance: (Number(currentCust.cashback_balance) || 0) + cashbackToAward - (Number(editingBill.deductedCashback) || 0)
          };
          
          // Ensure balance doesn't go negative
          if (updates.cashback_balance < 0) updates.cashback_balance = 0;

          await supabase
            .from('customers')
            .update(updates)
            .eq('id', editingBill.customerId);
        }
      }

      setCheckoutBill({ 
        ...editingBill, 
        remainingAfter: editingBill.remainingSubHours,
        realOverage: editingBill.realOverage || 0
      });
      setEditingBill(null);
      fetchSessions();
    } catch (err: any) {
      alert('حدث خطأ أثناء إنهاء الجلسة. يرجى مراجعة سجلات الكونسول.');
      console.error('Checkout Main Error:', err);
    }
  };

  const handleUpdateActiveSession = async () => {
    if (!editingBill) return;
    setLoading(true);
    try {
      const { error: sessionError } = await supabase
        .from('workspace_sessions')
        .update({
          start_time: editingBill.startTime,
          end_time: editingBill.endTime,
          total_minutes: Number(editingBill.diffMinutes) || 0,
          orders: editingBill.orders || [],
          catering_amount: Number(editingBill.cateringAmount) || 0,
          total_amount: Number(editingBill.totalAmount) || 0,
          notes: editingBill.notes || ''
        })
        .eq('id', editingBill.id);

      if (sessionError) throw sessionError;

      setEditingBill(null);
      fetchSessions();
      alert('تم حفظ التعديلات بنجاح');
      
      // Update customer interface
      supabase.channel(`workspace_session_${editingBill.id}`).send({
        type: 'broadcast',
        event: 'session_updated',
        payload: { id: editingBill.id, status: editingBill.status }
      });
    } catch (err: any) {
      console.error('Update Session Error:', err);
      alert('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCheckoutRequest = async (session: any) => {
    try {
      setLoading(true);
      const targetStatus = session.is_paused ? 'paused' : 'active';
      
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ 
            status: targetStatus,
            end_time: null 
        })
        .eq('id', session.id);

      if (error) throw error;
      setEditingBill(null);
      alert("تم إلغاء طلب الخروج وإعادة الجلسة للحالة النشطة");
      fetchSessions();
    } catch (err: any) {
      alert('خطأ في إلغاء الطلب: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartManualSession = async () => {
    if (!manualCode.trim()) return;
    setStartingSession(true);
    try {
      const { data: existing } = await supabase
        .from('workspace_sessions')
        .select('id')
        .eq('user_code', manualCode.trim().toUpperCase())
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      if (existing) {
        alert('هذا الكود لديه جلسة نشطة بالفعل');
        return;
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .eq('code', manualCode.trim().toUpperCase())
        .maybeSingle();

      const { error } = await supabase
        .from('workspace_sessions')
        .insert({
          customer_id: customer?.id || null,
          user_code: manualCode.trim().toUpperCase(),
          phone_number: customer?.phone || 'غير مسجل',
          status: 'active',
          branch_id: branchId,
          start_time: new Date().toISOString(),
          created_at: new Date().toISOString(),
          partner_id: activePartner ? activePartner.id : null
        });

      if (error) throw error;
      setManualCode('');
      fetchSessions();
      alert(customer ? `تم بدء جلسة لـ ${customer.full_name}` : `تم بدء جلسة زائر بكود ${manualCode.toUpperCase()}`);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء بدء الجلسة');
    } finally {
      setStartingSession(false);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'active').length;
  const requestedCount = sessions.filter(s => s.status === 'checkout_requested').length;

  return (
    <div className="space-y-12 animate-in fade-in duration-700 mt-6 pb-20">

      {/* Manual Entry Section */}
      <div className="glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -z-10" />
        <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-10">
          <div className="flex-1 text-center lg:text-right space-y-2">
            <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tighter">بدء جلسة يدوياً</h2>
            <p className="text-slate-400 font-bold text-[10px] md:text-sm uppercase tracking-widest">Manual Start • Guest or Registered User</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full lg:w-auto items-center gap-4">
            <div className="relative w-full sm:w-64 group/input">
              <input 
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="A001 , NA1 ..."
                className="w-full h-16 md:h-20 px-8 rounded-2xl bg-white border-2 border-slate-100 font-black text-xl md:text-2xl text-center focus:border-indigo-500 focus:ring-8 focus:ring-indigo-100 transition-all outline-none uppercase placeholder:text-slate-200 shadow-inner"
                onKeyDown={(e) => e.key === 'Enter' && handleStartManualSession()}
              />
            </div>
            <div className="relative w-full sm:w-48 flex bg-white border-2 border-slate-100 rounded-2xl focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-50 transition-all shadow-inner px-2 overflow-visible h-16 md:h-20 items-center">
              <Briefcase size={20} className={`ml-2 shrink-0 ${activePartner ? 'text-emerald-500' : 'text-slate-300'}`} />
              <input 
                type="text"
                value={partnerCode}
                onChange={(e) => {
                  setPartnerCode(e.target.value);
                  if (activePartner) setActivePartner(null);
                }}
                onBlur={() => partnerCode && handleVerifyPartner()}
                placeholder="كود النشاط"
                className="w-full bg-transparent font-black text-base md:text-lg text-center outline-none uppercase placeholder:text-slate-300"
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPartner()}
              />
              {activePartner ? (
                <div className="absolute top-[110%] left-0 right-0 bg-emerald-50 text-emerald-700 text-xs font-black p-3 rounded-2xl border border-emerald-100 shadow-xl z-[100] text-center animate-in slide-in-from-top-2 whitespace-nowrap">
                   {activePartner.name}
                </div>
              ) : isVerifyingPartner ? (
                 <RefreshCw size={16} className="animate-spin text-slate-300 shrink-0 mr-2" />
              ) : null}
            </div>
            <button 
              onClick={handleStartManualSession}
              disabled={startingSession || !manualCode.trim()}
              className="w-full sm:w-auto h-16 md:h-20 px-10 bg-slate-900 text-white rounded-2xl font-black text-sm md:text-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap"
            >
              {startingSession ? <RefreshCw className="animate-spin" size={24} /> : <Plus size={24} />}
              <span>بدء الجلسة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="glass rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px]" />
          <div className="flex items-center gap-4 md:gap-6 relative z-10">
            <div className="bg-indigo-500/20 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
              <Clock size={24} className="text-indigo-500 md:hidden" />
              <Clock size={32} className="text-indigo-500 hidden md:block" />
            </div>
            <div>
              <p className="text-slate-400 font-black text-[10px] md:text-sm mb-0.5 uppercase tracking-widest">جلسات نشطة</p>
              <h3 className="text-2xl md:text-4xl font-black text-slate-900">{activeCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px]" />
          <div className="flex items-center gap-4 md:gap-6 relative z-10">
            <div className="bg-amber-500/20 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
              <AlertCircle size={24} className="text-amber-500 md:hidden" />
              <AlertCircle size={32} className="text-amber-500 hidden md:block" />
            </div>
            <div>
               <p className="text-slate-400 font-black text-[10px] md:text-sm mb-0.5 uppercase tracking-widest">طلبات معلقة</p>
               <h3 className="text-2xl md:text-4xl font-black text-amber-600">
                  {sessions.filter(s => ['checkout_requested', 'pause_requested', 'resume_requested'].includes(s.status)).length}
               </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="text-center sm:text-right">
            <h2 className="text-xl md:text-2xl font-black text-slate-900">إدارة الجلسات الحالية</h2>
            <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Live Workspace Monitor</p>
          </div>
          <button 
            onClick={fetchSessions}
            className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="text-xs font-black sm:hidden tracking-wider">تحديث البيانات</span>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
            <table className="w-full text-right min-w-[800px]">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/30">
                  <th className="py-6 px-6 text-indigo-900 font-black">المستخدم</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">رقم الهاتف</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">وقت البدء</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">الوقت المنقضي</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">طلبات الكافتريا</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">الحالة</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">تحديث</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: any) => {
                  const start = new Date(session.start_time).getTime();
                  const currentRefTime = session.is_paused ? new Date(session.last_pause_start).getTime() : now;
                  const totalPausedMs = (Number(session.total_paused_minutes) || 0) * 60000;
                  const diffMs = Math.max(0, currentRefTime - start - totalPausedMs);
                  const totalMins = isNaN(diffMs) ? 0 : Math.floor(diffMs / 60000);
                  const hrs = Math.floor(totalMins / 60);
                  const mins = totalMins % 60;
                  
                  const activeSub = session.customers?.subscriptions?.find((s: any) => 
                    s.status === 'Active' && 
                    new Date(s.end_date) >= new Date() &&
                    s.used_hours < s.total_hours
                  );

                  return (
                    <tr 
                      key={session.id} 
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group"
                      style={{ backgroundColor: session.services?.color ? `${session.services.color}08` : undefined }}
                    >
                      <td className="py-6 px-6">
                        <div className="flex flex-row-reverse items-center justify-end gap-3 text-right">
                          <div className="text-right">
                            <div className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                              {session.services ? (
                                <div 
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-black text-xs shadow-sm transition-all hover:scale-105"
                                  style={{ 
                                    backgroundColor: `${session.services.color || '#4f46e5'}10`, 
                                    color: session.services.color || '#4f46e5',
                                    borderColor: `${session.services.color || '#4f46e5'}30`
                                  }}
                                >
                                  <Layout size={14} />
                                  {session.services.code || 'ROOM'}
                                </div>
                              ) : null}
                              {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم غير مسجل')}
                            </div>
                            <div className="flex flex-row-reverse items-center gap-2 mt-1">
                               <div className="text-sm font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg w-fit">{session.user_code}</div>
                               {session.partners && (
                                  <div className="flex flex-row-reverse items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black" title="نشاط / شريك">
                                     <Briefcase size={12} />
                                     <span>{session.partners.name}</span>
                                  </div>
                               )}
                               {activeSub && (
                                  <div className="flex flex-row-reverse items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black ">
                                     
                                     <span>Subscribed</span>
                                  </div>
                               )}
                            </div>
                            {activeSub && (
                                <div className="mt-2 space-y-1 text-right border-r-2 border-emerald-100 pr-2 mr-1">
                                  <p className="text-[9px] font-black text-slate-400">Ends: {new Date(activeSub.end_date).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' })}</p>
                                  <p className="text-[10px] font-black text-emerald-600">Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H</p>
                                </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-6 font-bold text-slate-600">{session.phone_number}</td>
                      <td className="py-6 px-6 font-semibold text-slate-600">
                        {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })}
                      </td>
                      <td className="py-6 px-6">
                        <div className={`font-mono text-lg font-black flex items-center justify-end gap-2 ${session.is_paused ? 'text-amber-500' : 'text-indigo-600'}`}>
                          {hrs}س {mins}د
                          {session.is_paused && <span className="text-[10px] bg-amber-100 px-1.5 py-0.5 rounded ml-2">P</span>}
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="font-black text-slate-900 text-lg">
                          {session.catering_amount || 0} EGP
                        </div>
                        <div className="text-xs text-slate-400 max-w-[200px] truncate mt-1">
                          {session.orders?.length > 0 ? session.orders.map((o: any) => `${o.quantity}x ${o.name}${o.ordered_by ? ` (${o.ordered_by})` : ''}`).join('، ') : 'بدون طلبات'}
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="flex flex-col gap-2">
                            {session.status === 'checkout_requested' && (
                              <div className="bg-rose-100 text-rose-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max animate-pulse">
                                <AlertCircle size={14} /> يطلب الخروج
                              </div>
                            )}
                            {session.status === 'pause_requested' && (
                              <div className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max animate-pulse">
                                <Clock size={14} /> طلب إيقاف
                              </div>
                            )}
                            {session.status === 'resume_requested' && (
                              <div className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max animate-pulse">
                                <RefreshCw size={14} /> طلب عودة
                              </div>
                            )}
                            {session.status === 'paused' && (
                              <div className="bg-slate-200 text-slate-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max">
                                <Lock size={14} /> متوقف مؤقتاً
                              </div>
                            )}
                            {session.status === 'active' && (
                              <div className="bg-emerald-100/50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max">
                                <CheckCircle2 size={14} /> نشط الآن
                              </div>
                            )}
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handlePrepareCheckout(session)}
                                className={`p-4 rounded-2xl transition-all shadow-sm ${session.status === 'checkout_requested' ? 'bg-rose-600 text-white animate-pulse shadow-rose-200' : 'bg-slate-900 text-white hover:bg-black shadow-slate-100'}`}
                                title="إنهاء ومحاسبة"
                              >
                                <Receipt size={22} className={session.status === 'checkout_requested' ? 'animate-bounce' : ''} />
                              </button>
                              
                              {session.status === 'pause_requested' && (
                                 <button 
                                   onClick={() => handleApprovePause(session)}
                                   className="p-4 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl transition-all animate-bounce shadow-lg shadow-amber-500/30"
                                   title="تأكيد طلب الإيقاف"
                                 >
                                   <Lock size={22} />
                                 </button>
                              )}

                              {session.status === 'active' && (
                                 <button 
                                   onClick={() => handleManualPause(session)}
                                   className="p-4 bg-amber-100 text-amber-600 hover:bg-amber-200 rounded-2xl transition-all"
                                   title="إيقاف الوقت يدوياً"
                                 >
                                   <Lock size={22} />
                                 </button>
                              )}

                              {session.status === 'resume_requested' && (
                                 <button 
                                   onClick={() => handleApproveResume(session)}
                                   className="p-4 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl transition-all animate-bounce shadow-lg shadow-emerald-500/30"
                                   title="تأكيد طلب الاستئناف"
                                 >
                                   <RefreshCw size={22} />
                                 </button>
                              )}

                              {session.status === 'paused' && (
                                 <button 
                                   onClick={() => handleApproveResume(session)}
                                   className="p-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-2xl transition-all border border-emerald-100"
                                   title="استئناف يدوياً"
                                 >
                                   <RefreshCw size={22} />
                                 </button>
                              )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sessions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-300">
                        <Users2 size={64} className="opacity-20" />
                        <p className="font-black text-xl">لا يوجد جلسات نشطة حالياً</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {sessions.map((session) => {
              const start = new Date(session.start_time).getTime();
              const currentRefTime = session.is_paused ? new Date(session.last_pause_start).getTime() : now;
              const totalPausedMs = (Number(session.total_paused_minutes) || 0) * 60000;
              const diffMs = Math.max(0, currentRefTime - start - totalPausedMs);
              const totalMins = isNaN(diffMs) ? 0 : Math.floor(diffMs / 60000);
              const hrs = Math.floor(totalMins / 60);
              const mins = totalMins % 60;
              
              const activeSub = session.customers?.subscriptions?.find((s: any) => 
                s.status === 'Active' && 
                new Date(s.end_date) >= new Date() &&
                s.used_hours < s.total_hours
              );

              return (
                <div 
                  key={session.id} 
                  className={`p-5 rounded-3xl border-2 transition-all duration-300 ${session.status === 'checkout_requested' ? 'border-amber-200' : 'border-slate-100'}`}
                  style={{ backgroundColor: session.services?.color ? `${session.services.color}08` : (session.status === 'checkout_requested' ? '#fdf6e7' : '#ffffff') }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-lg overflow-hidden shrink-0"
                        style={{ backgroundColor: session.services?.color || (session.status === 'checkout_requested' ? '#f59e0b' : '#4f46e5') }}
                      >
                        {session.services?.code || (session.status === 'checkout_requested' ? '!' : 'User')}
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900 text-base leading-tight">
                          {session.services?.name_ar || session.user_name || session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'Ù…سØªØ®دÙ…')}
                          {session.services?.name_ar && (session.user_name || session.customers?.full_name) && (session.user_name !== session.services?.name_ar) && (
                            <span className="text-slate-400 text-[10px] font-bold block mt-1">
                               ({session.user_name || session.customers?.full_name})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 mt-0.5">
                            {session.services && (
                                <span className="px-1.5 py-0.5 rounded-lg border mr-1" style={{ backgroundColor: `${session.services.color}15`, color: session.services.color, borderColor: `${session.services.color}30` }}>
                                    {session.services.code}
                                </span>
                            )}
                            {session.user_code} • {session.phone_number}
                        </div>
                      </div>
                    </div>
                    {session.status === 'checkout_requested' && (
                       <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">وقت البدء</p>
                       <p className="font-black text-slate-900 text-sm dir-ltr text-right">
                         {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })}
                       </p>
                    </div>
                    <div className="bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/30">
                       <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 text-right">مدة الجلسة</p>
                       <div className="font-black text-indigo-600 text-sm flex items-center justify-end gap-1.5">
                          <span>{hrs}س {mins}د</span>
                          <Clock size={12} />
                       </div>
                    </div>
                  </div>

                  {activeSub && (
                    <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 mb-4 flex justify-between items-center">
                       <div className="flex items-center gap-1.5 text-emerald-600">
                          <Sparkles size={14} className="" />
                          <span className="text-[10px] font-black uppercase">Subscribed</span>
                       </div>
                       <p className="text-[10px] font-black text-emerald-700">Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H</p>
                    </div>
                  )}

                  {session.partners && (
                    <div className="bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/50 mb-4 flex justify-between items-center text-indigo-700">
                       <div className="flex items-center gap-2">
                          <Briefcase size={14} />
                          <span className="text-[10px] font-black">{session.partners.name}</span>
                       </div>
                    </div>
                  )}

                    <div className="flex flex-wrap gap-2 pt-2">
                       {/* Control Buttons Grid */}
                       <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            onClick={() => handlePrepareCheckout(session)}
                            className={`h-16 rounded-2xl text-white font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                              session.status === 'checkout_requested' 
                                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200  col-span-2' 
                                : 'bg-slate-900 hover:bg-black shadow-slate-900/20 col-span-1'
                            }`}
                          >
                            <Receipt size={18} />
                            <span className="text-[11px]">{session.status === 'checkout_requested' ? 'إنهاء ومحاسبة فوراً' : 'إنهاء'}</span>
                          </button>

                          {(session.status === 'active' || session.status === 'pause_requested') && (
                             <button 
                               onClick={() => session.status === 'pause_requested' ? handleApprovePause(session) : handleManualPause(session)}
                               className={`h-16 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                                 session.status === 'pause_requested' 
                                   ? 'bg-amber-500 text-white animate-bounce shadow-amber-200 col-span-1' 
                                   : 'bg-amber-50 text-amber-600 border border-amber-100 col-span-1'
                               }`}
                             >
                               <Lock size={18} />
                               <span className="text-[11px]">إيقاف</span>
                             </button>
                          )}

                          {(session.status === 'paused' || session.status === 'resume_requested') && (
                             <button 
                               onClick={() => handleApproveResume(session)}
                               className={`h-16 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                                 session.status === 'resume_requested' 
                                   ? 'bg-emerald-500 text-white animate-bounce shadow-emerald-200 col-span-1' 
                                   : 'bg-emerald-50 text-emerald-600 border border-emerald-100 col-span-1'
                               }`}
                             >
                               <RefreshCw size={18} />
                               <span className="text-[11px]">استئناف</span>
                             </button>
                          )}
                          
                          {session.status === 'checkout_requested' && (
                             <button
                               onClick={() => handleCancelCheckoutRequest(session)}
                               className="col-span-2 py-4 text-rose-500 bg-rose-50 rounded-2xl text-[11px] font-black transition-colors flex items-center justify-center gap-2 border border-rose-100"
                             >
                               <X size={14} />
                               إلغاء طلب الخروج
                             </button>
                          )}
                       </div>
                    </div>
                  </div>
              );
            })}

            {sessions.length === 0 && !loading && (
              <div className="py-20 text-center glass rounded-[2rem] border-2 border-dashed border-slate-100">
                <Users2 size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="font-black text-slate-400">لا يوجد جلسات نشطة</p>
              </div>
            )}
          </div>
      </div>
      
      {/* Bill Adjustment Modal */}
      <Modal 
        isOpen={!!editingBill} 
        onClose={() => setEditingBill(null)} 
        title="مراجعة وتعديل الحساب"
        className="max-w-2xl"
      >
        {editingBill && (
            <div className="space-y-6 flex-1">
              {/* Subscription Info Badge */}
              {editingBill.isSubscribed && (
                 <div className="bg-indigo-900 text-white p-6 rounded-3xl relative overflow-hidden group shadow-xl">
                    {/* Renewal Option if Exhausted or Overage */}
                    {editingBill.remainingSubHours <= 5 && (
                       <div className="mt-4 pt-4 border-t border-white/10 relative z-20">
                          <label className="flex items-center justify-end gap-3 cursor-pointer group/renew">
                             <div className="text-right">
                                <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">تجديد الاشتراك الآن؟</p>
                                <p className="text-[8px] text-white/60">سيتم خصم الساعات الزائدة من الاشتراك الجديد</p>
                             </div>
                             <input 
                               type="checkbox" 
                               checked={!!renewalPkgId} 
                               onChange={(e) => {
                                 if (e.target.checked) {
                                    setRenewalPkgId(SUBSCRIPTION_PACKAGES[0].id);
                                    setRenewalPrice(SUBSCRIPTION_PACKAGES[0].price);
                                    setRenewalPaid(SUBSCRIPTION_PACKAGES[0].price);
                                 } else {
                                    setRenewalPkgId(null);
                                 }
                               }}
                               className="w-5 h-5 rounded-lg border-white/20 bg-white/10 text-emerald-500 focus:ring-offset-indigo-600"
                             />
                          </label>

                          {renewalPkgId && (
                             <div className="mt-4 space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                   {SUBSCRIPTION_PACKAGES.map(pkg => (
                                      <button 
                                        key={pkg.id}
                                        onClick={() => {
                                           setRenewalPkgId(pkg.id);
                                           setRenewalPrice(pkg.price);
                                           setRenewalPaid(pkg.price);
                                        }}
                                        className={`px-3 py-2 rounded-xl text-[9px] font-black transition-all border ${renewalPkgId === pkg.id ? 'bg-white text-indigo-600 border-white shadow-lg' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                                      >
                                         {pkg.name}
                                      </button>
                                   ))}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                                   <div className="text-right">
                                      <p className="text-[8px] font-black text-indigo-200 uppercase mb-1">السعـر</p>
                                      <input 
                                        type="number"
                                        value={renewalPrice}
                                        onChange={(e) => setRenewalPrice(Number(e.target.value))}
                                        className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs font-black text-white outline-none"
                                      />
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[8px] font-black text-indigo-200 uppercase mb-1">المدفوع</p>
                                      <input 
                                        type="number"
                                        value={renewalPaid}
                                        onChange={(e) => setRenewalPaid(Number(e.target.value))}
                                        className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs font-black text-emerald-400 outline-none"
                                      />
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[8px] font-black text-indigo-200 uppercase mb-1">المتبقي</p>
                                      <div className="w-full bg-white/5 border border-white/5 rounded-lg px-2 py-1 text-xs font-black text-rose-300">
                                         {Math.max(0, renewalPrice - renewalPaid)}
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}
                       </div>
                    )}
                   <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent -z-10" />
                   <div className="flex justify-between items-center relative z-10 text-right">
                      <div>
                         <p className="text-4xl font-black">{editingBill.remainingSubHours.toFixed(1)} <span className="text-sm opacity-50 uppercase tracking-widest">H Left</span></p>
                         <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">Expires: {new Date(editingBill.subEndDate).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <div className="text-right">
                         <div className="flex items-center gap-2 justify-end mb-1">
                            <h4 className="text-lg font-black">اشتراك فعال للساعات</h4>
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                         </div>
                         <p className="text-xs font-bold text-indigo-200">سيتم الخصم المباشر من رصيد العميل</p>
                      </div>
                   </div>
                </div>
              )}

              {/* Business Contract Info Badge */}
              {editingBill.contract?.type === 'Business' && (
                <div className="bg-slate-900 text-white mb-6 p-6 rounded-3xl relative overflow-hidden group shadow-xl">
                   <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-slate-500/20 to-transparent -z-10" />
                   <div className="flex justify-between items-center relative z-10 text-right">
                      <div>
                         <p className="text-4xl font-black">{editingBill.contract.prepaid_balance?.toFixed(2)} <span className="text-sm opacity-50 uppercase tracking-widest">EGP Left</span></p>
                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Shared Pre-paid Balance</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                         <div className="flex items-center gap-2 justify-end mb-1">
                            <h4 className="text-lg font-black">{editingBill.contract.partner_name}</h4>
                            <Briefcase size={18} className="text-indigo-400" />
                         </div>
                         <p className="text-xs font-bold text-slate-200">الطلبات ستخصم من رصيد الشركة</p>
                      </div>
                   </div>
                </div>
              )}

              {/* Time Control */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 relative group/start">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">وقت الدخول</label>
                    <div className="relative">
                      <input 
                        type="datetime-local" 
                        value={toCairoInput(editingBill.startTime)} 
                        onChange={(e) => handleUpdateTime('startTime', e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs md:text-sm font-black outline-none focus:border-indigo-400 transition-all text-right [color-scheme:light]"
                      />
                    </div>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 relative group/end">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">وقت الخروج</label>
                    <div className="relative">
                      <input 
                        type="datetime-local" 
                        value={toCairoInput(editingBill.endTime)} 
                        onChange={(e) => handleUpdateTime('endTime', e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs md:text-sm font-black outline-none focus:border-indigo-400 transition-all text-right [color-scheme:light]"
                      />
                    </div>
                 </div>
              </div>

              {/* User Info */}
              <div className="bg-slate-50 p-5 md:p-6 rounded-[2.5rem] grid grid-cols-2 md:grid-cols-3 gap-6 border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                <div className="text-right col-span-2 md:col-span-1">
                  <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest">العميل</p>
                  <p className="font-black text-slate-900 text-lg md:text-xl truncate">{editingBill.customers?.full_name || editingBill.user_code}</p>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest">وقت الجلسة</p>
                    <div className="flex items-center justify-end gap-1.5 font-black text-indigo-600">
                       <span className="text-base md:text-lg">{Math.floor(editingBill.diffMinutes / 60)}h {editingBill.diffMinutes % 60}m</span>
                       <Clock size={14} />
                    </div>
                </div>
                {editingBill.partners && (
                   <div className="text-right">
                       <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest">نشاط / شريك</p>
                       <div className="flex items-center justify-end gap-1.5 font-black text-emerald-600">
                          <span className="text-base md:text-lg">{editingBill.partners.name}</span>
                          <Briefcase size={14} />
                       </div>
                   </div>
                )}
                <div className="text-right">
                    <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest">وقت الجلسة</p>

                    <div className="flex items-center justify-end gap-1.5 font-black text-indigo-600">
                       <span className="text-base md:text-lg">{Math.floor(editingBill.diffMinutes / 60)}h {editingBill.diffMinutes % 60}m</span>
                       <Clock size={14} />
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-[9px] font-black uppercase mb-1 tracking-widest text-[#f78c2a]">مبلـغ المكان</p>
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="number" 
                        value={editingBill.workspaceAmount} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingBill({...editingBill, workspaceAmount: val, totalAmount: parseFloat((val + editingBill.cateringAmount).toFixed(2))});
                        }}
                        className={`w-24 h-10 text-center font-black bg-white border-2 border-slate-200 rounded-xl focus:border-[#f78c2a] focus:ring-4 focus:ring-[#f78c2a]/10 outline-none text-sm transition-all ${editingBill.isSubscribed ? 'opacity-30' : ''}`} 
                        disabled={editingBill.isSubscribed}
                      />
                    </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-black text-slate-700 text-sm">طلبات الكافتريا</h3>
                  <div className="flex gap-2">
                    <select 
                        className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg border-none outline-none cursor-pointer"
                        value=""
                        onChange={(e) => {
                            const prod = inventory.find(i => i.id === e.target.value);
                            if (prod) {
                                const newOrders = [...editingBill.orders, { 
                                    id: prod.id, 
                                    name: prod.name, 
                                    price: prod.retail_price, 
                                    quantity: 1,
                                    category: prod.category 
                                }];
                                const newCateringAmount = newOrders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
                                const newTotalAmount = parseFloat((Number(editingBill.workspaceAmount) + newCateringAmount).toFixed(2));
                                setEditingBill({
                                    ...editingBill,
                                    orders: newOrders,
                                    cateringAmount: newCateringAmount,
                                    totalAmount: newTotalAmount
                                });
                            }
                        }}
                    >
                        <option value="" disabled>+ إضافة صنف من المخزن</option>
                        {inventory.map((item: any) => (
                            <option key={item.id} value={item.id}>{item.name} - {item.retail_price} EGP</option>
                        ))}
                    </select>
                    <button onClick={handleAddBillItem} className="text-[10px] font-black bg-slate-50 text-slate-400 px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors">يدوي +</button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {editingBill.orders.map((o: any, idx: number) => (
                    <div key={idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-center bg-white p-4 border border-slate-100 rounded-[2rem] group hover:border-indigo-200 transition-all shadow-sm">
                       <div className="w-full sm:col-span-5 text-right font-black text-slate-800">
                         <div className="flex justify-between items-center mb-1">
                            <div className="flex gap-2 items-center">
                               {o.time && <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{new Date(o.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                               {o.ordered_by && <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">{o.ordered_by}</span>}
                            </div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest">اسم الصنف</p>
                         </div>
                         <input 
                           className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 outline-none text-sm" 
                           value={o.name} 
                           onChange={(e) => handleUpdateBillItem(idx, 'name', e.target.value)}
                         />
                       </div>
                       <div className="w-full sm:col-span-3 text-right">
                         <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">السعـر</p>
                         <input 
                           type="number" 
                           className="w-full text-center font-black text-emerald-600 bg-emerald-50/50 border-none rounded-xl px-3 py-2 outline-none text-sm" 
                           value={o.price} 
                           onChange={(e) => handleUpdateBillItem(idx, 'price', e.target.value)}
                         />
                       </div>
                       <div className="w-full sm:col-span-3 text-right">
                         <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">الكمية</p>
                         <input 
                           type="number" 
                           className="w-full text-center font-black text-indigo-600 bg-indigo-50/50 border-none rounded-xl px-3 py-2 outline-none text-sm" 
                           value={o.quantity || 1} 
                           onChange={(e) => handleUpdateBillItem(idx, 'quantity', e.target.value)}
                         />
                       </div>
                       <div className="w-full sm:col-span-1 flex justify-center sm:justify-end">
                         <button onClick={() => handleRemoveBillItem(idx)} className="text-rose-400 hover:text-rose-600 p-2 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 rounded-lg">
                            <X size={20} />
                         </button>
                       </div>
                    </div>
                  ))}
                  {editingBill.orders.length === 0 && (
                    <p className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">لا توجد طلبات مسجلة</p>
                  )}
                </div>
              </div>

              {/* Loyalty & Cashback Section */}
              {editingBill.customerId && (
                <div className="bg-emerald-50/50 p-6 rounded-[2.5rem] border border-emerald-100/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-right">
                       <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2 justify-end">
                         نظام الولاء والمكافآت
                         <Sparkles size={14} className="text-emerald-500" />
                       </h4>
                       <div className="flex flex-col gap-1 items-end mt-1">
                          <p className="text-[10px] text-emerald-600">سيربح العميل: {Math.floor(editingBill.diffMinutes / (60 / pointsPerHour))} نقطة</p>
                          <div className="flex gap-2 items-center mt-2">
                             <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded cursor-help" title="كل 4 نقاط = 1 ج.م (تقريباً 10 ساعات = 1 ساعة هدية)">
                                رصيد النقاط: {editingBill.customers?.loyalty_points || 0}
                             </span>
                             <button 
                               onClick={handleConvertPoints}
                               className="text-[9px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded hover:bg-indigo-600 transition-all shadow-sm"
                             >
                                تحويل النقاط لمبلغ
                             </button>
                          </div>
                        </div>
                    </div>
                    <div className="text-left">
                       <p className="text-[10px] font-bold text-slate-400">الرصيد الحالي: {editingBill.cashbackBalance} ج.م</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-400 mb-1">استخدام من الكاش باك (خصم من الفاتورة)</p>
                      <input 
                        type="number"
                        max={editingBill.cashbackBalance}
                        value={editingBill.deductedCashback || ''}
                        placeholder="0.00"
                        onChange={(e) => {
                          const val = Math.min(Number(editingBill.cashbackBalance), parseFloat(e.target.value) || 0);
                          const total = Math.max(0, parseFloat(((Number(editingBill.workspaceAmount) || 0) + (Number(editingBill.cateringAmount) || 0) - val).toFixed(2)));
                          setEditingBill({
                            ...editingBill,
                            deductedCashback: val,
                            totalAmount: total
                          });
                        }}
                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-black text-emerald-600 outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const val = Number(editingBill.cashbackBalance);
                        const total = Math.max(0, parseFloat(((Number(editingBill.workspaceAmount) || 0) + (Number(editingBill.cateringAmount) || 0) - val).toFixed(2)));
                        setEditingBill({
                          ...editingBill,
                          deductedCashback: val,
                          totalAmount: total
                        });
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl hover:bg-emerald-700 transition-all"
                    >
                      استخدام الكل
                    </button>
                  </div>
                </div>
              )}

              {/* Administrative Notes */}
              <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 relative group/notes">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-right">ملاحظات إضافية (Admin Notes)</label>
                <textarea 
                  className="w-full h-24 bg-white border border-slate-200 rounded-2xl p-4 text-xs font-black outline-none focus:border-indigo-400 transition-all text-right resize-none placeholder:text-slate-200 shadow-sm"
                  placeholder="أضف أي ملاحظات حول هذه الجلسة هنا..."
                  value={editingBill.notes || ''}
                  onChange={(e) => setEditingBill({...editingBill, notes: e.target.value})}
                />
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                 <div className="flex flex-col sm:flex-row justify-between items-center gap-8 text-center sm:text-right">
                    <div className="w-full sm:w-auto text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">الإجمالي المستحق</p>
                       <div className="flex items-center justify-end gap-2">
                         <span className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tighter">{editingBill.totalAmount}</span>
                         <span className="text-[10px] sm:text-sm font-black text-slate-300">EGP</span>
                       </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <button 
                          onClick={() => setEditingBill(null)} 
                          className="order-4 sm:order-1 w-full sm:w-auto px-6 py-4 rounded-[1.2rem] bg-slate-50 text-slate-500 font-black text-xs hover:bg-slate-100 transition-all active:scale-95"
                        >
                          تراجـع
                        </button>
                        
                        {editingBill.status === 'checkout_requested' && (
                          <button 
                            onClick={() => handleCancelCheckoutRequest(editingBill)} 
                            className="order-3 sm:order-2 w-full sm:w-auto px-6 py-4 rounded-[1.2rem] bg-rose-50 text-rose-600 font-black text-xs hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                          >
                            رفض الطلب
                          </button>
                        )}

                        <button 
                          onClick={handleUpdateActiveSession} 
                          disabled={loading}
                          className="order-2 sm:order-3 w-full sm:w-auto px-6 py-4 rounded-[1.2rem] bg-indigo-50 text-indigo-600 font-black text-xs hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-100"
                        >
                          تعديل فقط
                        </button>
                        
                        <button 
                          onClick={handleAcceptCheckout} 
                          className="order-1 sm:order-4 w-full sm:w-auto px-10 py-5 rounded-[1.5rem] bg-emerald-600 text-white font-black text-sm shadow-2xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95"
                        >
                          تأكيد محاسبة
                        </button>
                    </div>
                 </div>
              </div>
            </div>
        )}
      </Modal>

      {/* Checkout Success Bill Modal */}
      <Modal 
        isOpen={!!checkoutBill} 
        onClose={() => setCheckoutBill(null)} 
        title="فاتورة العميل"
        className="max-w-md"
      >
        {checkoutBill && (
            <div className="space-y-6 md:space-y-8">
              <div className="bg-slate-50/80 rounded-[2.5rem] p-6 md:p-8 space-y-6 relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                
                <div className="border-b-2 border-dashed border-slate-200 pb-6 text-center">
                  <p className="text-slate-400 text-[10px] md:text-xs font-black mb-2 uppercase tracking-widest">Client / Room Name</p>
                  <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                    {checkoutBill.user_name || checkoutBill.customers?.full_name || checkoutBill.services?.name_ar || (checkoutBill.user_code.startsWith('NA') ? `Guest (${checkoutBill.user_code})` : 'Unknown')}
                  </p>
                  <div className="mt-3">
                    <p className="text-sm md:text-lg font-black text-indigo-600 bg-white inline-block px-4 py-1.5 rounded-xl shadow-sm border border-indigo-50 font-mono tracking-wider">{checkoutBill.user_code}</p>
                  </div>
                </div>
                
                <div className="space-y-3 font-black text-slate-600">
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">وقت الاستخدام</span>
                    <span className="text-slate-900 text-sm md:text-base">
                       {Math.floor(checkoutBill.diffMinutes / 60)}h {checkoutBill.diffMinutes % 60}m
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">تكلفة الاستخدام</span>
                    <span className={`text-sm md:text-base ${checkoutBill.isSubscribed && checkoutBill.workspaceAmount === 0 ? 'text-indigo-600' : 'text-slate-900'}`}>
                       {checkoutBill.isSubscribed && checkoutBill.workspaceAmount === 0 ? '✓ اشتراك ساعات' : `${checkoutBill.workspaceAmount} EGP`}
                    </span>
                  </div>

                  {checkoutBill.isSubscribed && (
                    <div className="bg-indigo-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-500">
                      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-400/20 to-transparent -z-10" />
                      <div className="flex justify-between items-center relative z-10">
                        <div className="text-left">
                          <p className="text-xl md:text-2xl font-black">
                            {checkoutBill.remainingSubHours.toFixed(1)} 
                            <span className="text-[8px] md:text-[10px] opacity-40 uppercase ml-1">H Left</span>
                          </p>
                          <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {new Date(checkoutBill.subEndDate).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Subscription</p>
                          <p className="text-[11px] md:text-sm font-black text-indigo-100">{(Number(checkoutBill.usedHours) || 0).toFixed(2)}h used</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">طلبات الكافتيريا</span>
                    <span className="text-slate-900 text-sm md:text-base">{checkoutBill.cateringAmount} EGP</span>
                  </div>
                </div>
                
                {checkoutBill.orders && checkoutBill.orders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em] text-center">أصناف الضيافة</p>
                    <div className="space-y-2">
                       {checkoutBill.orders.map((o: any, idx: number) => (
                         <div key={idx} className="flex justify-between items-center text-[11px] md:text-sm font-black bg-white rounded-xl p-3 border border-slate-50 shadow-sm">
                           <div className="text-right">
                             <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-slate-500">{o.name} <span className="text-[9px] opacity-50 px-2 py-0.5 bg-slate-50 rounded">x{o.quantity || 1}</span></span>
                                {o.ordered_by && <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">{o.ordered_by}</span>}
                             </div>
                             {o.time && <p className="text-[8px] text-slate-200 font-bold">{new Date(o.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>}
                           </div>
                           <span className="text-slate-900 font-mono">{o.price} <span className="text-[8px] opacity-30">EGP</span></span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-8 mt-6 border-t-2 border-dashed border-slate-200 flex flex-col items-center gap-2">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">المبلغ النهائي للتحصيل</span>
                  <div className="relative">
                    <div className="absolute inset-x-0 bottom-2 h-4 bg-emerald-500/10 -rotate-1 rounded-full blur-[4px]" />
                    <p className="text-4xl md:text-6xl font-black text-emerald-600 relative z-10 italic">
                      {checkoutBill.totalAmount} 
                      <span className="text-lg md:text-xl opacity-30 ml-3 not-italic">EGP</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      updatePaymentMethod(checkoutBill.id, 'cash');
                      setCheckoutBill(null);
                    }}
                    className="group relative flex flex-col items-center justify-center py-6 bg-slate-900 text-white font-black rounded-[2.5rem] shadow-xl hover:bg-black hover:-translate-y-1 active:scale-95 transition-all text-sm overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <DollarSign size={24} className="mb-2 text-emerald-400" />
                    تحصيل كاش
                  </button>
                  <button
                    onClick={() => {
                        const amount = checkoutBill.totalAmount;
                        const ussdCode = `*9*7*01007480906*${amount}#`;
                        if (confirm(`تحويل فودافون كاش (${amount} ج.م)؟\nسيتم فتح لوحة الاتصال بالكود المباشر.`)) {
                           updatePaymentMethod(checkoutBill.id, 'vfcash');
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
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                        const phoneNumber = '01007480906';
                        navigator.clipboard.writeText(phoneNumber);
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        const isAndroid = /Android/.test(navigator.userAgent);
                        
                        updatePaymentMethod(checkoutBill.id, 'instapay');

                        if (isIOS || isAndroid) {
                          alert(`تم نسخ الرقم: ${phoneNumber}\nسيتم فتح تطبيق InstaPay.`);
                          if (isIOS) {
                            window.location.href = "instapay://";
                            setTimeout(() => { window.location.href = "https://apps.apple.com/eg/app/instapay-egypt/id1588619623"; }, 2500);
                          } else {
                            window.location.href = "intent://#Intent;scheme=instapay;package=com.egyptianbanks.instapay;end";
                          }
                        } else {
                          alert(`تم نسخ الرقم: ${phoneNumber}\nيرجى استخدامه في تطبيق InstaPay.`);
                          window.location.href = 'https://www.instapay.eg';
                        }
                    }}
                    className="flex items-center justify-center gap-2 py-4 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 transition-all text-xs"
                  >
                    <Smartphone size={14} />
                    تحويل InstaPay
                  </button>
                  <button
                    onClick={handlePrintReceipt}
                    className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-xs"
                  >
                    <Printer size={14} />
                    طباعة التذكرة
                  </button>
                </div>
              </div>
            </div>
        )}
      </Modal>

      {/* Printable Receipt Portal Container */}
      {checkoutBill && createPortal(
        <div id="printable-receipt" style={{ display: 'none' }}>
          <div className="text-center mb-6">
            <h1 className="text-xl font-black mb-1">CAMPUS HUB</h1>
            <p className="text-[10px] font-bold">بوابة الخدمات الطلابية المتكاملة</p>
            <div className="border-b-2 border-slate-900 my-4" />
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-xs">
              <span className="font-bold">رقم الجلسة:</span>
              <span>{checkoutBill.id.slice(0,8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-bold">التاريخ:</span>
              <span>{new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-bold">العميل / الغرفة:</span>
              <span>{checkoutBill.services?.name_ar || checkoutBill.user_name || checkoutBill.customers?.full_name || 'مستخدم'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-bold">الكود:</span>
              <span>{checkoutBill.user_code}</span>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-4 mb-4">
            <div className="flex justify-between text-xs font-black mb-2">
              <span>البند</span>
              <span>المبلغ</span>
            </div>
            <div className="flex justify-between text-[11px] mb-2">
              <span>استخدام المكان ({Math.floor(checkoutBill.diffMinutes / 60)}h {checkoutBill.diffMinutes % 60}m)</span>
              <span>{checkoutBill.workspaceAmount} EGP</span>
            </div>
            {checkoutBill.orders && checkoutBill.orders.length > 0 && (
              <div className="space-y-1">
                {checkoutBill.orders.map((o: any, i: number) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span>{o.name} x{o.quantity || 1}</span>
                    <span>{Number(o.price) * (o.quantity || 1)} EGP</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t-2 border-double border-slate-900 pt-4 space-y-2">
            {checkoutBill.deductedCashback > 0 && (
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>خصم مكافآت:</span>
                <span>-{checkoutBill.deductedCashback} EGP</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black pt-2">
              <span>الإجمالي:</span>
              <span>{checkoutBill.totalAmount} EGP</span>
            </div>
          </div>

          <div className="mt-8 text-center space-y-2 border-t border-slate-100 pt-6">
            <p className="text-[10px] font-bold">شكراً لزيارتكم • نتمنى لكم يوماً سعيداً</p>
            <p className="text-[8px] opacity-40">Powered by CampusOS Cloud System</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
