'use client';

import { useEffect, useRef, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ChatRoom, Message, ChatInvitation } from '@/types/ao';
import { Encryption } from '@/lib/encryption';
import VideoCallModal from '@/components/video/VideoCallModal';
import { WebRTCService } from '@/lib/webrtc';

interface ChatWindowProps {
  currentUserAddress: string;
  selectedContact: Contact | null;
  chatRoom: ChatRoom | null;
}

export default function ChatWindow({
  currentUserAddress,
  selectedContact,
  chatRoom
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const webrtcService = useRef<WebRTCService | null>(null);
  const [connectionStrategy, setConnectionStrategy] = useState<string>('');
  const [chatInvitations, setChatInvitations] = useState<ChatInvitation[]>([]);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 保存滚动位置
  const saveScrollPosition = () => {
    const messageList = messageListRef.current;
    if (!messageList) return 0;
    return messageList.scrollHeight - messageList.scrollTop;
  };

  // 恢复滚动位置
  const restoreScrollPosition = (previousHeight: number) => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight - previousHeight;
  };

  // 加载消息历史
  const loadMessages = async (page: number = 1) => {
    if (!chatRoom?.processId) return;
    
    try {
      setIsLoading(true);
      const result = await AOProcess.getChatroomMessages(
        chatRoom.processId,
        page
      );
      
      if (result.success) {
        if (page === 1) {
          setMessages(result.messages);
          scrollToBottom();
        } else {
          const previousHeight = saveScrollPosition();
          setMessages(prev => [...result.messages, ...prev]);
          setTimeout(() => restoreScrollPosition(previousHeight), 0);
        }
        setHasMore(result.hasMore);
      } else {
        console.error('Failed to load messages:', result.error);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // 可以添加用户提示
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化密钥
  useEffect(() => {
    const initializeKeys = async () => {
      if (!chatRoom) return;

      try {
        // 生成或获取密钥对
        let pair = keyPair;
        if (!pair) {
          pair = await Encryption.generateKeyPair();
          setKeyPair(pair);
        }

        // 存储公钥
        const publicJwk = await Encryption.exportPublicKey(pair.publicKey);
        await AOProcess.sendMessage(
          'StorePublicKey',
          { publicKey: publicJwk },
          chatRoom.processId
        );

        // 获取对方的公钥
        const result = await AOProcess.sendMessage(
          'GetPublicKey',
          { address: selectedContact.address },
          chatRoom.processId
        );

        if (result.success && result.publicKey) {
          const theirPublicKey = await Encryption.importPublicKey(result.publicKey);
          const shared = await Encryption.deriveSharedKey(
            theirPublicKey,
            pair.privateKey
          );
          setSharedKey(shared);
        }
      } catch (error) {
        console.error('Failed to initialize encryption:', error);
      }
    };

    initializeKeys();
  }, [chatRoom?.processId]);

  // 修改发送消息的函数
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatRoom?.processId || !newMessage.trim() || !sharedKey) return;

    try {
      // 加密消息
      const { encrypted, iv } = await Encryption.encryptMessage(
        newMessage.trim(),
        sharedKey
      );

      // 发送加密后的消息
      const result = await AOProcess.sendChatroomMessage(
        chatRoom.processId,
        encrypted,
        iv
      );
      
      if (result.success) {
        setNewMessage('');
        await loadMessages(1);
      } else {
        console.error('Failed to send message:', result.error);
        // 可以添加用户提示
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // 可以添加用户提示
    }
  };

  // 修改消息显示逻辑
  const renderMessage = async (message: any) => {
    if (!sharedKey) return message.encrypted;

    try {
      const decrypted = await Encryption.decryptMessage(
        message.encrypted,
        message.iv,
        sharedKey
      );
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return '[Encrypted Message]';
    }
  };

  // 监听滚动到顶部
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop === 0 && hasMore && !isLoadingMore) {
      await loadMoreMessages();
    }
  };

  // 加载更多消息
  const loadMoreMessages = async () => {
    if (!chatRoom?.processId || isLoadingMore) return;
    
    try {
      setIsLoadingMore(true);
      await loadMessages(currentPage + 1);
      setCurrentPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 定期刷新最新消息
  useEffect(() => {
    if (chatRoom?.processId) {
      loadMessages(1);
      const interval = setInterval(async () => {
        try {
          await loadMessages(1);
        } catch (error) {
          console.error('Failed to refresh messages:', error);
          // 可以添加重试逻辑
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [chatRoom?.processId]);

  // 初始化视频通话
  const initializeVideoCall = async () => {
    try {
      webrtcService.current = new WebRTCService();
      
      // 初始化本地流
      const stream = await webrtcService.current.initLocalStream();
      setLocalStream(stream);

      // 初始化对等连接
      await webrtcService.current.initConnection((stream) => {
        setRemoteStream(stream);
      });

      // 处理ICE候选
      webrtcService.current.onIceCandidate(async (candidate) => {
        if (candidate && chatRoom?.processId) {
          try {
            await AOProcess.sendMessage(
              'WebRTCSignal',
              {
                type: 'ice-candidate',
                data: candidate
              },
              chatRoom.processId
            );
          } catch (error) {
            console.error('Failed to send ICE candidate:', error);
          }
        }
      });

      // 创建并发送提议
      const offer = await webrtcService.current.createOffer();
      await AOProcess.sendMessage(
        'WebRTCSignal',
        {
          type: 'offer',
          data: offer
        },
        chatRoom.processId
      );

      // 显示当前使用的连接策略
      setConnectionStrategy(webrtcService.current.getConnectionStrategy());
    } catch (error) {
      console.error('Failed to initialize video call:', error);
      // 可以添加用户提示
    }
  };

  // 处理收到的WebRTC信令
  const handleWebRTCSignal = async (signal: any) => {
    if (!webrtcService.current) return;

    try {
      switch (signal.type) {
        case 'offer':
          const answer = await webrtcService.current.handleOffer(signal.data);
          await AOProcess.sendMessage(
            'WebRTCSignal',
            {
              type: 'answer',
              data: answer
            },
            chatRoom.processId
          );
          break;

        case 'answer':
          await webrtcService.current.handleAnswer(signal.data);
          break;

        case 'ice-candidate':
          await webrtcService.current.handleCandidate(signal.data);
          break;
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
    }
  };

  // 开始视频通话
  const startVideoCall = async () => {
    setIsVideoCallActive(true);
    await initializeVideoCall();
  };

  // 结束视频通话
  const endVideoCall = () => {
    if (webrtcService.current) {
      webrtcService.current.close();
    }
    setIsVideoCallActive(false);
    setLocalStream(null);
    setRemoteStream(null);
  };

  // 控制音频和视频
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

  // 添加聊天邀请处理UI
  {chatInvitations.length > 0 && (
    <div className="p-4 border-t border-gray-200">
      <h3 className="font-semibold mb-2">Chat Invitations</h3>
      {chatInvitations.map((invitation) => (
        <div key={invitation.processId} className="mb-2 p-2 bg-gray-50 rounded">
          <div className="text-sm">From: {invitation.fromNickname}</div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleAcceptChatInvitation(invitation)}
              className="text-xs bg-green-500 text-white px-2 py-1 rounded"
            >
              Join Chat
            </button>
            <button
              onClick={() => handleRejectChatInvitation(invitation)}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )}

  // 添加处理函数
  const handleAcceptChatInvitation = async (invitation: ChatInvitation) => {
    try {
      const result = await AOProcess.acceptChatroom(invitation.processId);
      if (result.success) {
        await loadChatInvitations();
      }
    } catch (error) {
      console.error('Failed to accept chat invitation:', error);
    }
  };

  const handleRejectChatInvitation = async (invitation: ChatInvitation) => {
    try {
      const result = await AOProcess.rejectChatroom(invitation.processId);
      if (result.success) {
        await loadChatInvitations();
      }
    } catch (error) {
      console.error('Failed to reject chat invitation:', error);
    }
  };

  // 添加加载函数
  const loadChatInvitations = async () => {
    try {
      const result = await AOProcess.getChatroomInvitations();
      if (result.success) {
        setChatInvitations(result.chatInvitations || []);
      }
    } catch (error) {
      console.error('Failed to load chat invitations:', error);
    }
  };

  // 添加聊天邀请加载的 useEffect
  useEffect(() => {
    loadChatInvitations();
    const interval = setInterval(loadChatInvitations, 10000);
    return () => clearInterval(interval);
  }, []);

  // 未选择联系人时的显示
  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a contact to start chatting
      </div>
    );
  }

  // 未创建聊天室时的显示
  if (!chatRoom) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Start a chat with {selectedContact.nickname}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* 聊天头部 */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="font-semibold">{selectedContact.nickname}</h2>
          <div className="text-sm text-gray-500">{selectedContact.address}</div>
        </div>
        <button
          onClick={() => setIsVideoCallActive(true)}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* 聊天邀请部分 - 新添加 */}
      {chatInvitations.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">Chat Invitations</h3>
          {chatInvitations.map((invitation) => (
            <div key={invitation.processId} className="mb-2 p-2 bg-gray-50 rounded">
              <div className="text-sm">From: {invitation.fromNickname}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleAcceptChatInvitation(invitation)}
                  className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                >
                  Join Chat
                </button>
                <button
                  onClick={() => handleRejectChatInvitation(invitation)}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div 
        ref={messageListRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {isLoadingMore && (
          <div className="text-center py-2">
            Loading more messages...
          </div>
        )}
        {messages.map((message, index) => (
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
              <div className="text-sm">{renderMessage(message)}</div>
              <div className="text-xs mt-1 opacity-75">
                {new Date(message.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 消息输入框 */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
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

      {/* 视频通话模态框 */}
      <VideoCallModal
        isOpen={isVideoCallActive}
        onClose={() => setIsVideoCallActive(false)}
        contact={selectedContact!}
        isCaller={true}
        localStream={localStream}
        remoteStream={remoteStream}
        onToggleAudio={() => setIsAudioEnabled(!isAudioEnabled)}
        onToggleVideo={() => setIsVideoEnabled(!isVideoEnabled)}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
      />

      {/* 连接状态 */}
      <div className="text-sm text-gray-400 mt-2">
        Connection: {connectionStrategy}
      </div>
    </div>
  );
} 