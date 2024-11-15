'use client';

import { useEffect, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { ChatRoom, ChatInvitation } from '@/types/ao';
import Notification from '../common/Notification';

interface ContactsListProps {
  onCreateChat: (participantAddress: string) => Promise<void>;
  onChatInvitationAccepted: (chatRoom: ChatRoom) => Promise<void>;
  isCreatingChat: boolean;
}

// 创建聊天模态框组件
interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (address: string) => Promise<void>;
  isSubmitting: boolean;
}

function CreateChatModal({ isOpen, onClose, onSubmit, isSubmitting }: CreateChatModalProps) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) {
      setError('Address is required');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{43}$/.test(address)) {
      setError('Invalid Arweave address format');
      return;
    }

    try {
      console.log('[CreateChat] Attempting to create chat with address:', address);
      await onSubmit(address.trim());
      setAddress('');
      onClose();
    } catch (error) {
      console.error('[CreateChat] Error details:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chat');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">Create New Chat</h2>
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Participant AR Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactsList({
  onCreateChat,
  onChatInvitationAccepted,
  isCreatingChat
}: ContactsListProps) {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatInvitations, setChatInvitations] = useState<ChatInvitation[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[Chat] Loading data...');
      
      const result = await AOProcess.getChatrooms();
      console.log('[Chat] Get chatrooms result:', result);

      if (result.success) {
        setChatRooms(result.chatrooms || []);
        setChatInvitations(result.invitations || []);
      } else {
        console.error('[Chat] Failed to load chatrooms:', result.error);
      }

      setError(null);
    } catch (error) {
      console.error('[Chat] Load data failed:', error);
      setError('Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptChatInvitation = async (invitation: ChatInvitation) => {
    try {
      console.log('[Chat] Accepting chat invitation:', invitation);
      await onChatInvitationAccepted(invitation);
      setNotification({
        type: 'success',
        message: 'Joined chat successfully'
      });
      await loadData();
    } catch (error) {
      console.error('[Chat] Accept chat invitation failed:', error);
      setNotification({
        type: 'error',
        message: 'Failed to join chat'
      });
    }
  };

  const handleCreateChat = async (participantAddress: string) => {
    try {
      console.log('[Chat] Creating chatroom with:', participantAddress);
      
      // 创建聊天室（包含spawn进程和发送邀请）
      const result = await AOProcess.createChatroom(participantAddress);
      
      if (result.success && result.chatroom) {
        setNotification({
          type: 'success',
          message: 'Chat room created and invitation sent'
        });
        
        // 重新加载聊天室列表
        await loadData();
      } else {
        throw new Error(result.error || 'Failed to create chat room');
      }
    } catch (error) {
      console.error('[Chat] Create chat failed:', error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create chat'
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;

    const refreshData = async () => {
      if (!mounted) return;
      await loadData();
    };

    refreshData();
    interval = setInterval(refreshData, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-80 border-r border-gray-200 h-full flex flex-col">
      {/* Create Chat Button */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded flex items-center justify-center transition-colors duration-200"
        >
          <span className="mr-2">+</span> Create New Chat
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-100 text-red-600">
          {error}
        </div>
      )}

      {/* Chat Invitations */}
      {chatInvitations.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">Chat Invitations</h3>
          {chatInvitations.map((invitation) => (
            <div
              key={invitation.processId}
              className="mb-2 p-2 bg-gray-50 rounded transform transition-all duration-300 hover:scale-102 hover:shadow-md"
            >
              <div className="text-sm font-medium">From: {invitation.fromNickname}</div>
              <div className="text-xs text-gray-500 mb-2">{invitation.from}</div>
              <button
                onClick={() => handleAcceptChatInvitation(invitation)}
                className="w-full text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors duration-200"
              >
                Join Chat
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chat Rooms List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading chats...</div>
          </div>
        ) : chatRooms.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No chats yet
          </div>
        ) : (
          chatRooms.map((chatRoom) => (
            <div
              key={chatRoom.processId}
              className="p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="font-semibold">Chat Room</div>
              <div className="text-sm text-gray-500">
                Participants: {chatRoom.participants.length}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Chat Modal */}
      <CreateChatModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateChat}
        isSubmitting={isCreatingChat}
      />

      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
} 