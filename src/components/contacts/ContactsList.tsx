'use client';

import { useEffect, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ContactInvitation } from '@/types/ao';
import Notification from '../common/Notification';

interface ContactsListProps {
  onStartChat: (contact: Contact) => void;
  isCreatingChat?: boolean;
}

// 添加联系人模态框组件
interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (address: string, nickname: string) => Promise<void>;
  isSubmitting: boolean;
}

function AddContactModal({ isOpen, onClose, onSubmit, isSubmitting }: AddContactModalProps) {
  const [address, setAddress] = useState('');
  const [nickname, setNickname] = useState('');
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
    if (!nickname) {
      setError('Nickname is required');
      return;
    }

    try {
      await onSubmit(address.trim(), nickname.trim());
      setAddress('');
      setNickname('');
      onClose();
    } catch (error) {
      console.error('[AddContact] Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to add contact');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-xl animate-fade-in">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add New Contact
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AR Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Enter Arweave address"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Enter nickname"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding...
                </div>
              ) : (
                'Add Contact'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactsList({
  onStartChat,
  isCreatingChat = false
}: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitations, setInvitations] = useState<ContactInvitation[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadData = async (retryCount = 0) => {
    try {
      if (retryCount === 0 && contacts.length === 0) {
        setIsLoading(true);
      }
      
      const [invitationsResult, contactsResult] = await Promise.all([
        AOProcess.getPendingInvitations(),
        AOProcess.getContacts()
      ]);

      if (invitationsResult.success && invitationsResult.data?.invitations) {
        const newInvitations = invitationsResult.data.invitations;
        setInvitations(prev => 
          JSON.stringify(prev) !== JSON.stringify(newInvitations) ? newInvitations : prev
        );
      }

      if (contactsResult.success && Array.isArray(contactsResult.data?.contacts)) {
        const formattedContacts = contactsResult.data.contacts.map(contact => ({
          address: contact.address,
          nickname: contact.nickname || `User-${contact.address.slice(0, 6)}`,
          status: 'offline'
        }));
        
        setContacts(prev => 
          JSON.stringify(prev) !== JSON.stringify(formattedContacts) ? formattedContacts : prev
        );
      }
    } catch (error) {
      console.error('[Contacts] Load data failed:', error);
      if (contacts.length === 0) {
        setError(error instanceof Error ? error.message : 'Failed to load contacts');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async (address: string, nickname: string) => {
    try {
      setNotification({
        type: 'info',
        message: 'Sending invitation...'
      });

      console.log('[Contacts] Adding contact:', { address, nickname });
      
      const result = await AOProcess.sendInvitation(address, nickname);
      
      if (result.error?.includes('initialization')) {
        setNotification({
          type: 'info',
          message: 'Chat service is initializing, please wait a moment and try again.'
        });
        return;
      }
      
      if (result.success) {
        setNotification({
          type: 'success',
          message: 'Invitation sent successfully'
        });
        await loadData();
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('[Contacts] Add contact failed:', error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to add contact'
      });
    }
  };

  const handleAcceptInvitation = async (invitation: ContactInvitation) => {
    try {
      console.log('[Contacts] Accepting invitation:', invitation);
      
      const result = await AOProcess.acceptInvitation(
        invitation.from,
        `User-${invitation.from.slice(0, 6)}`
      );
      
      if (result.success) {
        setNotification({
          type: 'success',
          message: 'Contact added successfully'
        });
        await loadData();
      } else {
        throw new Error(result.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('[Contacts] Accept invitation failed:', error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to accept invitation'
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;
    let lastInteractionTime = Date.now();

    const updateLastInteraction = () => {
      lastInteractionTime = Date.now();
    };

    window.addEventListener('mousemove', updateLastInteraction);
    window.addEventListener('keydown', updateLastInteraction);
    window.addEventListener('click', updateLastInteraction);

    const refreshData = async () => {
      if (!mounted) return;
      
      if (Date.now() - lastInteractionTime < 5 * 60 * 1000) {
        // 定期发送 AddUser
        const address = await window.arweaveWallet.getActiveAddress();
        await AOProcess.addUser(`User_${address.slice(0, 6)}`);
        
        // 然后加载数据
        await loadData();
      }
    };

    refreshData();
    interval = setInterval(refreshData, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('mousemove', updateLastInteraction);
      window.removeEventListener('keydown', updateLastInteraction);
      window.removeEventListener('click', updateLastInteraction);
    };
  }, []);

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleStartChat = (contact: Contact) => {
    onStartChat(contact);
    setSelectedContact(null); // 清除选中状态
  };

  return (
    <div className="w-80 border-r border-gray-200 h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 transform hover:shadow-md active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Contact</span>
        </button>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <input
            type="text"
            placeholder="Search contacts..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* 在 Contacts List div 之前添加 Invitations Section */}
      {invitations.length > 0 && (
        <div className="border-b border-gray-200">
          <div className="p-4 bg-blue-50">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Pending Invitations</h3>
            {invitations.map((invitation) => (
              <div key={invitation.from} className="bg-white p-3 rounded-lg shadow-sm mb-2 last:mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">
                      New Contact Request
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      From: {invitation.from.slice(0, 8)}...{invitation.from.slice(-6)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAcceptInvitation(invitation)}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={async () => {
                        // TODO: 实现拒绝邀请的功能
                        console.log('Reject invitation:', invitation);
                      }}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <svg className="w-12 h-12 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>No contacts yet</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.address}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 border-b border-gray-100
                ${selectedContact?.address === contact.address ? 'bg-gray-50' : ''}`}
              onClick={() => handleContactClick(contact)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-semibold">
                  {contact.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{contact.nickname}</div>
                  <div className="text-sm text-gray-500 truncate font-mono">
                    {contact.address.slice(0, 8)}...{contact.address.slice(-6)}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${contact.status === 'online' ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>
              {selectedContact?.address === contact.address && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartChat(contact);
                  }}
                  className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Chat
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddContact}
        isSubmitting={false}
      />

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