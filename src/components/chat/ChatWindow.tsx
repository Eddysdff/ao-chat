'use client';

import { useEffect, useRef, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ChatMessage } from '@/types/ao';
import { Encryption } from '@/lib/encryption';
import VideoCallModal from '@/components/video/VideoCallModal';
import { WebRTCService } from '@/lib/webrtc';

interface ChatWindowProps {
  currentUserAddress: string;
  selectedContact: Contact | null;
}

export default function ChatWindow({
  currentUserAddress,
  selectedContact
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const webrtcService = useRef<WebRTCService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef(Date.now());

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 更新最后交互时间
  const updateLastInteraction = () => {
    lastInteractionRef.current = Date.now();
  };

  // 加载消息历史
  const loadMessages = async (retryCount = 0) => {
    if (!selectedContact) return;

    try {
      if (retryCount === 0) {
        setIsLoading(true);
      }

      const result = await AOProcess.getMessages(selectedContact.address);
      
      if (result.success && result.messages) {
        const decryptedMessages = await Promise.all(
          result.messages.map(async (msg) => {
            if (msg.encrypted && sharedKey) {
              try {
                const decrypted = await Encryption.decryptMessage(
                  msg.content,
                  msg.iv || '',
                  sharedKey
                );
                return { ...msg, content: decrypted };
              } catch (error) {
                console.error('[Chat] Failed to decrypt message:', error);
                return { ...msg, content: '[Encrypted Message]' };
              }
            }
            return msg;
          })
        );
        
        // 只在消息有变化时更新状态
        const hasNewMessages = JSON.stringify(messages) !== JSON.stringify(decryptedMessages);
        if (hasNewMessages) {
          setMessages(decryptedMessages);
          scrollToBottom();
        }
      }
      
      setError(null);
    } catch (error) {
      console.error('[Chat] Load messages failed:', error);
      if (error instanceof Error && error.message.includes('network') && retryCount < 3) {
        setTimeout(() => loadMessages(retryCount + 1), 1000 * Math.pow(2, retryCount));
        return;
      }
      setError('Failed to load messages');
    } finally {
      if (retryCount === 0) {
        setIsLoading(false);
      }
    }
  };

  // 初始化加密
  useEffect(() => {
    const initializeEncryption = async () => {
      if (!selectedContact) return;

      try {
        // 生成或获取密钥对
        let pair = keyPair;
        if (!pair) {
          pair = await Encryption.generateKeyPair();
          setKeyPair(pair);
        }

        // 导出并存储公钥
        const publicJwk = await Encryption.exportPublicKey(pair.publicKey);
        const privateJwk = await Encryption.exportPrivateKey(pair.privateKey);

        // 生成共享密钥
        const shared = await Encryption.deriveSharedKey(
          pair.publicKey,
          pair.privateKey
        );
        setSharedKey(shared);

      } catch (error) {
        console.error('[Chat] Encryption initialization failed:', error);
        setError('Failed to initialize encryption');
      }
    };

    initializeEncryption();
  }, [selectedContact]);

  // 定期刷新消息
  useEffect(() => {
    if (!selectedContact) return;

    let mounted = true;
    let interval: NodeJS.Timeout;

    // 添加用户交互监听
    window.addEventListener('mousemove', updateLastInteraction);
    window.addEventListener('keydown', updateLastInteraction);
    window.addEventListener('click', updateLastInteraction);

    const refreshMessages = async () => {
      if (!mounted) return;
      
      // 只在用户最近5分钟有交互时刷新
      const isActive = Date.now() - lastInteractionRef.current < 5 * 60 * 1000;
      if (isActive) {
        await loadMessages();
      }
    };

    refreshMessages();
    // 增加轮询间隔到15秒
    interval = setInterval(refreshMessages, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('mousemove', updateLastInteraction);
      window.removeEventListener('keydown', updateLastInteraction);
      window.removeEventListener('click', updateLastInteraction);
    };
  }, [selectedContact]);

  // 发送消息
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newMessage.trim()) return;

    try {
      let content = newMessage.trim();
      let encrypted = false;

      // 如果有共享密钥，加密消息
      if (sharedKey) {
        const { encrypted: encryptedContent, iv } = await Encryption.encryptMessage(
          content,
          sharedKey
        );
        content = encryptedContent;
        encrypted = true;
      }

      const result = await AOProcess.sendMessage(
        selectedContact.address,
        content,
        encrypted
      );

      if (result.success) {
        setNewMessage('');
        updateLastInteraction(); // 更新最后交互时间
        await loadMessages();
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('[Chat] Send message failed:', error);
      setError('Failed to send message');
    }
  };

  // 视频通话相关功能
  const initializeVideoCall = async () => {
    try {
      webrtcService.current = new WebRTCService();
      const stream = await webrtcService.current.initLocalStream();
      setLocalStream(stream);
      
      await webrtcService.current.initConnection((stream) => {
        setRemoteStream(stream);
      });
    } catch (error) {
      console.error('[Chat] Video call initialization failed:', error);
      setError('Failed to initialize video call');
    }
  };

  const toggleAudio = () => {
    if (webrtcService.current) {
      const newState = !isAudioEnabled;
      webrtcService.current.toggleAudio(newState);
      setIsAudioEnabled(newState);
    }
  };

  const toggleVideo = () => {
    if (webrtcService.current) {
      const newState = !isVideoEnabled;
      webrtcService.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
    }
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a contact to start chatting
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="font-semibold">{selectedContact.nickname}</h2>
          <div className="text-sm text-gray-500">{selectedContact.address}</div>
        </div>
        <button
          onClick={() => {
            setIsVideoCallActive(true);
            initializeVideoCall();
          }}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No messages yet
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={`mb-4 flex ${
                message.sender === currentUserAddress ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender === currentUserAddress
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100'
                }`}
              >
                <div className="text-sm">{message.content}</div>
                <div className="text-xs mt-1 opacity-75">
                  {new Date(message.timestamp * 1000).toLocaleTimeString()}
                  {message.encrypted && ' 🔒'}
                  {message.status === 'delivered' && ' ✓'}
                  {message.status === 'read' && ' ✓✓'}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
        {error && (
          <div className="mb-2 text-sm text-red-500">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={isVideoCallActive}
        onClose={() => {
          setIsVideoCallActive(false);
          if (webrtcService.current) {
            webrtcService.current.close();
          }
          setLocalStream(null);
          setRemoteStream(null);
        }}
        contact={selectedContact}
        isCaller={true}
        localStream={localStream}
        remoteStream={remoteStream}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
      />
    </div>
  );
} 