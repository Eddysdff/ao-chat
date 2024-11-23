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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentChat, setCurrentChat] = useState<{
    contact: Contact;
    messages: Message[];
  } | null>(null);

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

  const handleStartChat = (contact: Contact) => {
    setCurrentChat({
      contact,
      messages: []  // 初始化空消息列表
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!currentChat || !address) return;

    try {
      const result = await AOProcess.sendMessage(
        currentChat.contact.address,
        content,
        false  // 暂时不加密
      );

      if (result.success) {
        // 发送成功后立即刷新消息
        loadMessages();
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('[Chat] Send message failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const loadMessages = async () => {
    if (!currentChat || !address) return;

    try {
      const result = await AOProcess.getMessages(currentChat.contact.address);
      if (result.success && result.data?.messages) {
        setCurrentChat(prev => ({
          ...prev!,
          messages: result.data.messages
        }));
      }
    } catch (error) {
      console.error('[Chat] Load messages failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
    }
  };

  // 定期刷新消息
  useEffect(() => {
    if (!currentChat) return;

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [currentChat?.contact.address]);

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
              onClick={handleConnect}
              className="ml-4 text-red-500 hover:text-red-600 underline"
            >
              Retry
            </button>
          </p>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <ContactsList
          onStartChat={handleStartChat}
        />
        {currentChat && (
          <ChatWindow
            contact={currentChat.contact}
            messages={currentChat.messages}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>
    </div>
  );
} 