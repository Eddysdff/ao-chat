'use client';

import { useEffect, useRef } from 'react';
import { Contact } from '@/types/ao';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact;
  isCaller: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

export default function VideoCallModal({
  isOpen,
  onClose,
  contact,
  isCaller,
  localStream,
  remoteStream,
  onToggleAudio,
  onToggleVideo,
  isAudioEnabled,
  isVideoEnabled
}: VideoCallModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const handleVideoError = (e: Event) => {
      console.error('Video error:', e);
      // 可以在这里添加错误提示UI
    };

    if (localVideoRef.current) {
      localVideoRef.current.addEventListener('error', handleVideoError);
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.addEventListener('error', handleVideoError);
    }

    return () => {
      if (localVideoRef.current) {
        localVideoRef.current.removeEventListener('error', handleVideoError);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.removeEventListener('error', handleVideoError);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-4 w-full max-w-4xl">
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-white">
            <h3 className="font-semibold">{contact.nickname}</h3>
            <p className="text-sm text-gray-400">{contact.address}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 视频显示区域 */}
        <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden mb-4">
          {/* 远程视频 */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* 本地视频（小窗口） */}
          <div className="absolute bottom-4 right-4 w-48 aspect-video bg-gray-700 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* 添加连接状态指示器 */}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white bg-black bg-opacity-50 px-4 py-2 rounded">
                {isCaller ? 'Calling...' : 'Connecting...'}
              </div>
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <div className="flex justify-center space-x-4">
          {/* 音频控制 */}
          <button
            onClick={onToggleAudio}
            className={`p-3 rounded-full ${
              isAudioEnabled ? 'bg-gray-700' : 'bg-red-500'
            }`}
          >
            {isAudioEnabled ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          {/* 视频控制 */}
          <button
            onClick={onToggleVideo}
            className={`p-3 rounded-full ${
              isVideoEnabled ? 'bg-gray-700' : 'bg-red-500'
            }`}
          >
            {isVideoEnabled ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>

          {/* 结束通话 */}
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-red-500"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>

        {/* 添加连接状态显示 */}
        <div className="text-center text-gray-400 mt-4 text-sm">
          {!remoteStream && (
            <div>
              {isCaller ? 'Waiting for answer...' : 'Incoming call...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 