'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArConnectService } from '@/lib/arconnect';
import { AOProcess } from '@/lib/ao-process';
import Navbar from '@/components/Navbar';
import ContactsList from '@/components/contacts/ContactsList';
import ChatWindow from '@/components/chat/ChatWindow';
import { ChatRoom } from '@/types/ao';

export default function ChatPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const addr = await ArConnectService.connectWallet();
      setAddress(addr);
      setError(null);
    } catch (error) {
      console.error('Connection failed:', error);
      setError('Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingConnection = async () => {
    try {
      setIsLoading(true);
      const isConnected = await ArConnectService.isConnected();
      
      if (isConnected) {
        const addr = await ArConnectService.getAddress();
        setAddress(addr);
        setError(null);
      } else {
        setAddress(null);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setError('Failed to check wallet connection');
      setAddress(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      if (!mounted) return;
      await checkExistingConnection();
    };

    checkConnection();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateChat = async (participantAddress: string) => {
    if (!address) return;
    
    try {
      setIsCreatingChat(true);
      setError(null);

      console.log('[Chat] Creating chatroom with participant:', participantAddress);
      
      // 先检查进程状态
      const processState = await AOProcess.debugState();
      console.log('[Chat] Current process state:', processState);

      const result = await AOProcess.createChatroom(participantAddress);
      console.log('[Chat] Create chatroom result:', result);

      if (result?.success && result.chatroom) {
        setActiveChatRoom(result.chatroom);
      } else {
        console.error('[Chat] Failed to create chatroom:', result);
        throw new Error(result?.error || 'Failed to create chatroom');
      }
    } catch (error) {
      console.error('[Chat] Error creating chatroom:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chat room. Please try again.');
      throw error; // 重新抛出错误以便上层组件处理
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleChatInvitationAccepted = async (chatRoom: ChatRoom) => {
    try {
      setError(null);
      // 加入聊天室
      const joinResult = await AOProcess.joinChatroom(chatRoom.processId);
      if (joinResult.success) {
        setActiveChatRoom(chatRoom);
      } else {
        throw new Error(joinResult.error || 'Failed to join chatroom');
      }
    } catch (error) {
      console.error('Error joining chatroom:', error);
      setError('Failed to join chat room. Please try again.');
    }
  };

  // 添加重新连接功能
  const handleReconnect = async () => {
    try {
      setError(null);
      await checkExistingConnection();
    } catch (error) {
      console.error('Reconnection failed:', error);
      setError('Failed to reconnect. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">
      <div className="text-lg">Loading...</div>
    </div>;
  }

  if (!address) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">Welcome to Chat</h1>
          <button
            onClick={handleConnect}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded"
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {error && <div className="text-red-500 mt-2">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Navbar address={address} />
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p className="flex items-center">
            <span className="mr-2">⚠️</span>
            {error}
            <button
              onClick={handleReconnect}
              className="ml-4 text-red-500 hover:text-red-600 underline"
            >
              Retry
            </button>
          </p>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <ContactsList
          onCreateChat={handleCreateChat}
          onChatInvitationAccepted={handleChatInvitationAccepted}
          isCreatingChat={isCreatingChat}
        />
        <ChatWindow
          currentUserAddress={address}
          chatRoom={activeChatRoom}
        />
      </div>
    </div>
  );
} 