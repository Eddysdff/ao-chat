'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArConnectService } from '@/lib/arconnect';
import { AOProcess } from '@/lib/ao-process';
import Navbar from '@/components/Navbar';
import ContactsList from '@/components/contacts/ContactsList';
import ChatWindow from '@/components/chat/ChatWindow';
import { Contact, Message } from '@/types/ao';
import { Encryption } from '@/lib/encryption';

// 修改消息类型定义
interface RawMessage {
  timestamp: number;
  content: string;
  encrypted: boolean;
  sender: string;
}

interface ProcessMessageResponse {
  success: boolean;
  data?: {
    messages: RawMessage[];
  };
}

export default function ChatPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentChat, setCurrentChat] = useState<{
    contact: Contact;
    messages: Message[];
  } | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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
      messages: []
    });
    
    loadMessages(contact.address);
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

  const loadMessages = async (contactAddress?: string) => {
    const targetAddress = contactAddress || currentChat?.contact.address;
    if (!targetAddress || !address) return;

    try {
      if (!currentChat?.messages.length) {
        setIsLoadingMessages(true);
      }
      
      const result = await AOProcess.getMessages(targetAddress);
      console.log('[Chat] Messages result:', result);
      
      if (result?.success && result?.data?.messages) {
        setCurrentChat(prev => {
          if (!prev) return null;

          try {
            // 首先确保消息数组符合预期格式
            const rawMessages = (result.data?.messages || []).map(msg => ({
              ...msg,
              encrypted: false
            })) as RawMessage[];
            
            // 转换消息格式以匹配 Message 接口
            const newMessages: Message[] = rawMessages.map(msg => ({
              id: String(msg.timestamp),
              sender: msg.sender,
              content: msg.content,
              timestamp: msg.timestamp,
              status: 'delivered' as const,
              encrypted: msg.encrypted
            }));

            console.log('[Chat] Formatted messages:', newMessages);

            // 检查消息是否有变化
            if (JSON.stringify(prev.messages) === JSON.stringify(newMessages)) {
              return prev;
            }

            return {
              ...prev,
              messages: newMessages
            };
          } catch (error) {
            console.error('[Chat] Message format error:', error);
            return prev;
          }
        });
      }
    } catch (error) {
      console.error('[Chat] Load messages failed:', error);
      if (!currentChat?.messages.length) {
        setError('Failed to load messages. New messages can still be sent.');
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!currentChat) return;

    let timeoutId: NodeJS.Timeout;
    const refreshMessages = async () => {
      await loadMessages();
      timeoutId = setTimeout(refreshMessages, 5000);
    };

    refreshMessages();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentChat?.contact.address]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl mx-auto transform rotate-45 relative">
              <div className="absolute inset-0 flex items-center justify-center -rotate-45">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AO-Chat</h1>
          <p className="text-gray-600 mb-8">Connect your wallet to start messaging</p>
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="group relative w-full"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-200" />
            <div className="relative flex items-center justify-center px-6 py-3 bg-white rounded-lg">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-2" />
                  <span className="text-primary-700">Connecting...</span>
                </>
              ) : (
                <span className="text-primary-700">Connect Wallet</span>
              )}
            </div>
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navbar address={address} />
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-600 p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={handleConnect}
              className="text-sm text-red-700 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-gray-200 bg-white shadow-sm">
          <ContactsList onStartChat={handleStartChat} />
        </div>
        
        <div className="flex-1 bg-white">
          {currentChat ? (
            <ChatWindow
              contact={currentChat.contact}
              messages={currentChat.messages}
              onSendMessage={handleSendMessage}
              isLoadingMessages={isLoadingMessages}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Select a Contact</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Choose a contact to start a new conversation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 