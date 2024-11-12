'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getActiveAddress } from '@/lib/arconnect';
import { AOProcess } from '@/lib/ao-process';
import Navbar from '@/components/Navbar';
import ContactsList from '@/components/contacts/ContactsList';
import ChatWindow from '@/components/chat/ChatWindow';
import { Contact, ChatRoom } from '@/types/ao';

export default function ChatPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const addr = await getActiveAddress();
        if (!addr) {
          router.push('/');
          return;
        }
        
        setAddress(addr);
        
        // 只检查一次Process健康状态
        const isHealthy = await AOProcess.checkHealth();
        if (!isHealthy) {
          setError('Unable to connect to AO Process. Please try again later.');
        }
      } catch (error) {
        console.error('Connection check failed:', error);
        router.push('/');
      }
    };

    checkConnection();
  }, []); // 空依赖数组确保只运行一次

  const handleStartChat = async (contact: Contact) => {
    if (!address) return;
    
    try {
      setIsCreatingChat(true);
      setError(null);

      // 添加重试机制
      const maxRetries = 3;
      let result;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await AOProcess.createChatroom(contact.address);
          if (result.success && result.chatroom) {
            break;
          }
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
      
      if (result?.success && result.chatroom) {
        setActiveChatRoom(result.chatroom);
      } else {
        throw new Error(result?.error || 'Failed to create chatroom');
      }
    } catch (error) {
      console.error('Error creating chatroom:', error);
      setError('Failed to create chat room. Please try again.');
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
      await checkConnection();
    } catch (error) {
      console.error('Reconnection failed:', error);
      setError('Failed to reconnect. Please try again.');
    }
  };

  if (!address) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Connecting to wallet...</p>
          <button
            onClick={handleReconnect}
            className="text-green-500 hover:text-green-600"
          >
            Retry Connection
          </button>
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
          selectedContact={selectedContact}
          onSelectContact={setSelectedContact}
          onStartChat={handleStartChat}
          onChatInvitationAccepted={handleChatInvitationAccepted}
          isCreatingChat={isCreatingChat}
        />
        <ChatWindow
          currentUserAddress={address}
          selectedContact={selectedContact}
          chatRoom={activeChatRoom}
        />
      </div>
    </div>
  );
} 