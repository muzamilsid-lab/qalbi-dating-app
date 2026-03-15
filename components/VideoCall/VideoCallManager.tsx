'use client';

import { AnimatePresence } from 'framer-motion';
import { useCallback }     from 'react';
import { useVideoCall }    from '@/lib/video/hooks/useVideoCall';
import { VideoCallRing }   from './VideoCallRing';
import { VideoCallPreview} from './VideoCallPreview';
import { VideoCallScreen } from './VideoCallScreen';
import { VideoCallEnded }  from './VideoCallEnded';

interface Props {
  myUserId:      string;
  myDisplayName: string;
  onNavigateToChat: (conversationId: string) => void;
}

/**
 * VideoCallManager — mount once at app level (e.g. in root layout).
 * It handles:
 *   - Incoming ring notifications
 *   - Pre-call camera test
 *   - Active call screen
 *   - Post-call feedback
 */
export function VideoCallManager({ myUserId, myDisplayName, onNavigateToChat }: Props) {
  const call = useVideoCall({ myUserId, myDisplayName });

  const handleRatingSubmit = useCallback(async (rating: number, unmatch: boolean, note?: string) => {
    if (!call.callId || rating === 0) return;

    await fetch('/api/video/rating', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callId: call.callId, rating, unmatchAfter: unmatch, note }),
    }).catch(() => {});

    if (unmatch) {
      await fetch('/api/video/end', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ callId: call.callId, action: 'unmatch' }),
      }).catch(() => {});
    }
  }, [call.callId]);

  return (
    <AnimatePresence>
      {/* Incoming ring */}
      {call.status === 'ringing' && call.incomingRing && (
        <VideoCallRing
          key="ring"
          ring={call.incomingRing}
          onAccept={call.acceptCall}
          onDecline={call.declineCall}
        />
      )}

      {/* Pre-call camera/mic test */}
      {call.status === 'pre-call' && (
        <VideoCallPreview
          key="preview"
          partnerName={call.remoteParticipant?.displayName ?? 'your match'}
          onJoin={call.joinRoom}
          onCancel={() => call.declineCall()}
        />
      )}

      {/* Active call */}
      {(call.status === 'joining' || call.status === 'active') && (
        <VideoCallScreen
          key="active"
          callId={call.callId!}
          myUserId={myUserId}
          myDisplayName={myDisplayName}
          localState={call.localState}
          remoteParticipant={call.remoteParticipant}
          extensionCount={call.extensionCount}
          startedAt={call.startedAt}
          onToggleVideo={call.toggleVideo}
          onToggleAudio={call.toggleAudio}
          onSetBlur={call.setBackgroundEffect}
          onToggleBeauty={call.toggleBeauty}
          onExtend={call.extendCall}
          onEndCall={() => call.endCall('local_hangup')}
          onReport={call.reportUser}
          captureFrame={call.captureFrame}
        />
      )}

      {/* Post-call feedback */}
      {call.status === 'ended' && (
        <VideoCallEnded
          key="ended"
          callId={call.callId!}
          duration="0:00"   // populated by parent from call.startedAt + endedAt
          partnerName={call.remoteParticipant?.displayName ?? 'your match'}
          partnerPhoto={null}
          endReason={call.endReason}
          onRatingSubmit={handleRatingSubmit}
          onContinueChat={() => {
            const convId = call.conversationId;
            call.dismissEnded();
            if (convId) onNavigateToChat(convId);
          }}
          onDismiss={call.dismissEnded}
        />
      )}
    </AnimatePresence>
  );
}

// Make the initiateCall function accessible from chat
export { useVideoCall };
