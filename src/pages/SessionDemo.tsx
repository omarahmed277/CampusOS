import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeBilling } from '../hooks/useRealtimeBilling';

const SessionDemo: React.FC = () => {
    const sb = supabase as any;
    // Mock user ID (In real app, get from auth context)
    const [userId, setUserId] = useState('00000000-0000-0000-0000-000000000000'); // Use a real UUID for testing
    const { activeSession, latestBill, loading, checkIn, requestCheckout } = useRealtimeBilling(userId);
    const [isAdmin, setIsAdmin] = useState(false);
    const [pendingSessions, setPendingSessions] = useState<any[]>([]);

    // Fetch pending checkouts for admin
    React.useEffect(() => {
        if (isAdmin) {
            const fetchPending = async () => {
                const { data } = await sb
                    .from('sessions')
                    .select('*')
                    .eq('status', 'pending_checkout');
                setPendingSessions(data || []);
            };
            fetchPending();

            // Real-time admin listener for pending sessions
            const adminChannel = supabase
                .channel('admin-sessions')
                .on(
                    'postgres_changes' as any,
                    { event: 'UPDATE', schema: 'public', table: 'sessions', filter: 'status=eq.pending_checkout' },
                    (payload: any) => {
                        setPendingSessions(prev => [...prev.filter(s => s.id !== payload.new.id), payload.new]);
                    }
                )
                .on(
                    'postgres_changes' as any,
                    { event: 'UPDATE', schema: 'public', table: 'sessions', filter: 'status=eq.completed' },
                    (payload: any) => {
                        setPendingSessions(prev => prev.filter(s => s.id !== payload.new.id));
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(adminChannel);
            };
        }
    }, [isAdmin]);

    const handleApprove = async (sessionId: string) => {
        const { error } = await sb
            .from('sessions')
            .update({ status: 'completed', check_out: new Date().toISOString() })
            .eq('id', sessionId);
        if (error) alert('Error approving: ' + error.message);
    };

    if (!userId) return <div>Please sign in first...</div>;

    return (
        <div className="p-8 space-y-8 bg-gray-900 min-h-screen text-white">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Real-Time Session & Billing System
            </h1>

            <div className="flex gap-4 mb-4">
                <button 
                    onClick={() => setIsAdmin(!isAdmin)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                    Switch to {isAdmin ? 'User' : 'Admin'} Mode
                </button>
            </div>

            {!isAdmin ? (
                /* USER FLOW */
                <div className="p-6 rounded-xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm">
                    <h2 className="text-xl font-semibold mb-4">User Dashboard</h2>
                    
                    {loading ? (
                        <p>Loading session data...</p>
                    ) : !activeSession ? (
                        <div className="space-y-4">
                            <p className="text-gray-400">No active session found.</p>
                            <button 
                                onClick={() => checkIn()}
                                className="px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold transition-all transform hover:scale-105"
                            >
                                START SESSION (Check-in)
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-500/30">
                                <p className="font-mono text-emerald-400">Status: {activeSession.status.toUpperCase()}</p>
                                <p className="text-sm text-gray-400">Check-in: {new Date(activeSession.check_in).toLocaleString()}</p>
                            </div>
                            
                            {activeSession.status === 'active' && (
                                <button 
                                    onClick={() => requestCheckout(activeSession.id)}
                                    className="px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-500 font-bold transition-all"
                                >
                                    REQUEST CHECKOUT
                                </button>
                            )}

                            {activeSession.status === 'pending_checkout' && (
                                <div className="animate-pulse text-amber-500 font-semibold">
                                    Waiting for Admin approval...
                                </div>
                            )}
                        </div>
                    )}

                    {latestBill && (
                        <div className="mt-8 p-6 rounded-xl border border-blue-500/50 bg-blue-900/20 animate-in fade-in zoom-in duration-500">
                            <h3 className="text-lg font-bold text-blue-400 mb-2">⚡ NEW BILL GENERATED!</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase">Amount Due</p>
                                    <p className="text-2xl font-bold">${latestBill.amount.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase">Generated At</p>
                                    <p className="text-sm">{new Date(latestBill.created_at).toLocaleTimeString()}</p>
                                </div>
                            </div>
                            <button className="mt-4 w-full py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500">
                                Pay Now
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* ADMIN FLOW */
                <div className="p-6 rounded-xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm">
                    <h2 className="text-xl font-semibold mb-4 text-indigo-400">Admin Dashboard</h2>
                    
                    {pendingSessions.length === 0 ? (
                        <p className="text-gray-500">No pending checkouts to approve.</p>
                    ) : (
                        <div className="grid gap-4">
                            {pendingSessions.map(session => (
                                <div key={session.id} className="p-4 rounded-lg border border-gray-700 bg-gray-900 flex justify-between items-center">
                                    <div>
                                        <p className="font-mono text-xs text-indigo-400">{session.id}</p>
                                        <p className="text-sm">User ID: {session.user_id}</p>
                                        <p className="text-xs text-gray-500">Started: {new Date(session.check_in).toLocaleString()}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleApprove(session.id)}
                                        className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 font-semibold"
                                    >
                                        Approve & End Session
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SessionDemo;
