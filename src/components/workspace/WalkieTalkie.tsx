import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, PhoneOff, Radio, Volume2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WalkieTalkieProps {
  userId: string;
  userName: string;
  branchId: string;
  isAdmin?: boolean;
  isEmbedded?: boolean;
}

export const WalkieTalkie = ({ userId, userName, branchId, isAdmin = false, isEmbedded = false }: WalkieTalkieProps) => {
  const [status, setStatus] = useState<'idle' | 'calling' | 'connected' | 'incoming'>('idle');
  const [isTalking, setIsTalking] = useState(false);
  const [remoteUser, setRemoteUser] = useState<{ id: string, name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const isSubscribed = useRef(false);

  const statusRef = useRef(status);
  const remoteUserRef = useRef(remoteUser);
  
  useEffect(() => {
    statusRef.current = status;
    remoteUserRef.current = remoteUser;
  }, [status, remoteUser]);

  useEffect(() => {
    if (!branchId) return;

    // Setup signaling channel
    const channelName = `support_voice_${branchId}`;
    console.log(`[WalkieTalkie] Joining channel: ${channelName}`);
    
    channelRef.current = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    channelRef.current
      .on('broadcast', { event: 'call_request' }, ({ payload }: any) => {
        console.log('[WalkieTalkie] Received call_request', payload);
        if (isAdmin) {
          if (statusRef.current === 'idle') {
            setRemoteUser({ id: payload.userId, name: payload.userName });
            setStatus('incoming');
            playRingtone(payload.userName);
          } else if (statusRef.current !== 'incoming') {
            // Send busy signal back to the requester
            sendWithFallback('busy', { targetId: payload.userId });
          }
        }
      })
      .on('broadcast', { event: 'busy' }, ({ payload }: any) => {
        if (!isAdmin && payload.targetId === userId && statusRef.current === 'calling') {
          setError("المسؤول مشغول حالياً، يرجى المحاولة لاحقاً");
          setTimeout(() => endCall(true), 3000);
        }
      })
      .on('broadcast', { event: 'call_accept' }, ({ payload }: any) => {
        console.log('[WalkieTalkie] Received call_accept', payload);
        if (!isAdmin && payload.userId === userId && statusRef.current === 'calling') {
          stopRingtone();
          startWebRTC(payload.adminId);
        }
      })
      .on('broadcast', { event: 'webrtc_signal' }, ({ payload }: any) => {
        if (payload.targetId === userId) {
          handleSignaling(payload.signalData, payload.senderId);
        }
      })
      .on('broadcast', { event: 'call_end' }, ({ payload }: any) => {
        if (remoteUserRef.current?.id === payload.senderId) {
          endCall(false);
        }
      })
      .on('broadcast', { event: 'ptt_status' }, ({ payload }: any) => {
        // Handle visual feedback
      })
      .subscribe((status: string) => {
        console.log(`[WalkieTalkie] Subscription status: ${status}`);
        isSubscribed.current = status === 'SUBSCRIBED';
      });

    return () => {
      if (channelRef.current) {
        console.log(`[WalkieTalkie] Leaving channel: ${channelName}`);
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [branchId, isAdmin, userId]);

  const sendWithFallback = (event: string, payload: any) => {
    if (!channelRef.current) return;
    
    const message = {
      type: 'broadcast',
      event,
      payload
    };

    if (isSubscribed.current) {
      channelRef.current.send(message);
    } else {
      // Fallback to REST explicitly if socket is not ready yet
      // In newer SDKs, send() might handle this but warns. 
      // We can try to use untyped access or just wait for subscription.
      // For signaling, we really want the socket.
      setTimeout(() => {
        if (isSubscribed.current) channelRef.current.send(message);
      }, 500);
    }
  };

  useEffect(() => {
    if (isAdmin && status === 'idle') {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [isAdmin, status]);

  const playRingtone = (callerName?: string) => {
    if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        ringtoneRef.current.loop = true;
    }
    ringtoneRef.current.play().catch(e => {
        console.warn("Audio play failed, user interaction may be required:", e);
        setError("يرجى الضغط على أي مكان في الصفحة لتفعيل التنبيهات الصوتية");
    });

    // Show system notification
    if (isAdmin && 'Notification' in window && Notification.permission === 'granted') {
      new Notification("طلب مساعدة جديد", {
        body: `العميل ${callerName || remoteUser?.name || 'مجهول'} يطلب التحدث معك`,
        icon: '/logo.png',
        tag: 'support-call',
        renotify: true,
        silent: false
      } as any);
    }

    // Vibrate mobile device
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const checkPermissions = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (result.state === 'denied') {
        setError("Microphone access is denied. Please enable it in browser settings.");
        return false;
      }
      return true;
    } catch (e) {
      // Fallback for browsers that don't support permissions query for mic
      return true;
    }
  };

  const startWebRTC = async (targetId: string) => {
    try {
      const isAllowed = await checkPermissions();
      if (!isAllowed) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      // Mute local stream initially (Toggle mode)
      stream.getAudioTracks().forEach(track => track.enabled = isTalking);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(targetId, { ice: event.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WalkieTalkie] ICE State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setError("Connection lost. Retrying...");
          // In a real app, we might try to restart ICE here
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      if (!isAdmin) {
        const offer = await pc.createOffer({
            offerToReceiveAudio: true
        });
        await pc.setLocalDescription(offer);
        sendSignal(targetId, { sdp: offer });
      }

      pcRef.current = pc;
      setStatus('connected');
      setError(null);
    } catch (err: any) {
      console.error("WebRTC Error:", err);
      setError("Unable to access microphone. Please check permissions.");
      endCall(true);
    }
  };

  const handleSignaling = async (data: any, senderId: string) => {
    if (!pcRef.current && isAdmin && data.sdp) {
        // Admin side: Received offer
        setRemoteUser({ id: senderId, name: remoteUser?.name || 'User' });
        await startWebRTC(senderId);
    }

    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (pc.remoteDescription?.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(senderId, { sdp: answer });
        }
      } else if (data.ice) {
        await pc.addIceCandidate(new RTCIceCandidate(data.ice));
      }
    } catch (err) {
      console.error("Signaling error:", err);
    }
  };

  const sendSignal = (targetId: string, signalData: any) => {
    sendWithFallback('webrtc_signal', { targetId, signalData, senderId: userId });
  };

  const initiateCall = async () => {
    if (status !== 'idle') return;
    
    const isAllowed = await checkPermissions();
    if (!isAllowed) return;

    setStatus('calling');
    sendWithFallback('call_request', { userId, userName });
  };

  const acceptCall = () => {
    stopRingtone();
    if (!remoteUser) return;
    sendWithFallback('call_accept', { userId: remoteUser.id, adminId: userId });
    // startWebRTC will be triggered by handleSignaling on admin side
  };

  const endCall = (silent: boolean) => {
    stopRingtone();
    if (!silent && remoteUser) {
      sendWithFallback('call_end', { senderId: userId });
    }

    if (pcRef.current) pcRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    
    pcRef.current = null;
    localStreamRef.current = null;
    setStatus('idle');
    setRemoteUser(null);
  };

  const togglePTT = () => {
    if (status !== 'connected' || !localStreamRef.current) return;
    
    const newTalkingState = !isTalking;
    setIsTalking(newTalkingState);
    localStreamRef.current.getAudioTracks().forEach(track => track.enabled = newTalkingState);
    
    sendWithFallback('ptt_status', { senderId: userId, isTalking: newTalkingState });
  };

  return (
    <div className="font-['Cairo']">
      <audio ref={remoteAudioRef} autoPlay />
      
      {status === 'idle' && !isAdmin && (
        <button
          onClick={initiateCall}
          className="group relative flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all active:scale-95 shadow-lg shadow-indigo-900/30 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Radio size={14} className="animate-pulse" />
          <span className="relative z-10 uppercase tracking-widest">تحدث مع المسؤول</span>
        </button>
      )}

      {status === 'calling' && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl animate-pulse">
          <Phone className="text-amber-500 animate-bounce" size={16} />
          <span className="text-xs font-black text-amber-500">جاري الاتصال بالمسؤول...</span>
          <button onClick={() => endCall(false)} className="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><X size={14} /></button>
        </div>
      )}

      {status === 'incoming' && (
        <div className={`${isEmbedded ? 'w-full' : 'fixed bottom-24 right-6 z-[200] max-w-xs animate-in slide-in-from-right-10'} bg-slate-900 border border-indigo-500/30 p-6 rounded-[2rem] shadow-2xl duration-500`}>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white animate-pulse">
                <Phone size={24} />
             </div>
             <div className="text-right flex-1">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">طلب اتصال صوتي</p>
                <h4 className="text-white font-black">{remoteUser?.name}</h4>
             </div>
          </div>
          <div className="flex gap-2">
             <button 
               onClick={acceptCall}
               className="flex-1 h-12 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all"
             >
                <Volume2 size={16} /> قبول
             </button>
             <button 
               onClick={() => endCall(false)}
               className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
             >
                <PhoneOff size={18} />
             </button>
          </div>
        </div>
      )}

      {status === 'connected' && (
        <div className={`flex items-center gap-3 ${isEmbedded ? 'w-full justify-between' : (isAdmin ? 'fixed bottom-24 right-6 z-[200] bg-slate-900 border border-emerald-500/30 p-4 rounded-3xl shadow-2xl' : '')}`}>
          <div className="flex flex-col items-end gap-1 flex-1">
             <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                {isAdmin ? `متصل مع: ${remoteUser?.name}` : 'متصل مع المسؤول'}
             </p>
             <div 
               onClick={togglePTT}
               className={`h-14 w-full px-6 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-all cursor-pointer select-none active:scale-95 ${
                 isTalking 
                   ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40 animate-pulse' 
                   : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
               }`}
             >
                <Mic size={18} className={isTalking ? 'animate-bounce' : ''} />
                <span>{isTalking ? 'إيقاف الميكروفون' : 'بدأ التحدث (اضغط هنا)'}</span>
             </div>
          </div>
          <button 
            onClick={() => endCall(false)}
            className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all flex-shrink-0"
          >
             <PhoneOff size={20} />
          </button>
        </div>
      )}

      {error && (
        <div className="text-[10px] text-rose-500 flex items-center gap-1 font-bold mt-1">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
};

export default WalkieTalkie;
