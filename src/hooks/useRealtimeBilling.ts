import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Use simple local interfaces to avoid deep recursion from the main Database type
interface Session {
    id: string;
    user_id: string;
    check_in: string;
    check_out: string | null;
    status: 'active' | 'pending_checkout' | 'completed';
    total_minutes: number | null;
    rate_per_hour: number;
}

interface Bill {
    id: string;
    session_id: string;
    user_id: string;
    amount: number;
    rate_per_hour: number;
    created_at: string;
}

export function useRealtimeBilling(userId: string) {
    const sb = supabase as any;
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [latestBill, setLatestBill] = useState<Bill | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const fetchInitialState = async () => {
            setLoading(true);
            const { data: sessionData } = await sb
                .from('sessions')
                .select('*')
                .eq('user_id', userId)
                .neq('status', 'completed')
                .order('check_in', { ascending: false })
                .maybeSingle();

            if (sessionData) {
                setActiveSession(sessionData);
            }

            const { data: billData } = await sb
                .from('bills')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (billData) {
                setLatestBill(billData);
            }
            setLoading(false);
        };

        fetchInitialState();

        const sessionChannel = supabase
            .channel(`user-sessions-${userId}`)
            .on(
                'postgres_changes' as any,
                {
                    event: '*',
                    schema: 'public',
                    table: 'sessions',
                    filter: `user_id=eq.${userId}`
                },
                (payload: any) => {
                    if (payload.new.status === 'completed') {
                        setActiveSession(null);
                    } else {
                        setActiveSession(payload.new as Session);
                    }
                }
            )
            .subscribe();

        const billChannel = supabase
            .channel(`user-bills-${userId}`)
            .on(
                'postgres_changes' as any,
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'bills',
                    filter: `user_id=eq.${userId}`
                },
                (payload: any) => {
                    setLatestBill(payload.new as Bill);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sessionChannel);
            supabase.removeChannel(billChannel);
        };
    }, [userId]);

    const checkIn = async (ratePerHour: number = 50.0) => {
        const { data, error } = await sb
            .from('sessions')
            .insert([{ user_id: userId, status: 'active', rate_per_hour: ratePerHour }])
            .select()
            .single();
        return { data, error };
    };

    const requestCheckout = async (sessionId: string) => {
        const { data, error } = await sb
            .from('sessions')
            .update({ status: 'pending_checkout' })
            .eq('id', sessionId)
            .select()
            .single();
        return { data, error };
    };

    return { 
        activeSession, 
        latestBill, 
        loading,
        checkIn,
        requestCheckout
    };
}
