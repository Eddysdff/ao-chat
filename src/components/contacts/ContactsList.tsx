'use client';

import { useEffect, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ContactInvitation } from '@/types/ao';
import AddContactModal from './AddContactModal';

interface ContactsListProps {
  selectedContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
  onStartChat: (contact: Contact) => void;
  isCreatingChat: boolean;
}

export default function ContactsList({
  selectedContact,
  onSelectContact,
  onStartChat,
  isCreatingChat
}: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitations, setInvitations] = useState<ContactInvitation[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const verifyProcessState = async () => {
    try {
      const result = await AOProcess.sendMessage('DebugState');
      console.log('[Contacts] Process state:', result);
      return result.success;
    } catch (error) {
      console.error('[Contacts] Process state check failed:', error);
      return false;
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[Contacts] Loading data...');
      
      const [contactsResult, invitationsResult] = await Promise.all([
        AOProcess.getContacts(),
        AOProcess.getPendingInvitations()
      ]);

      console.log('[Contacts] Raw results:', {
        contacts: contactsResult,
        invitations: invitationsResult
      });

      // 处理联系人数据
      if (contactsResult && contactsResult.success) {
        const contactsList = contactsResult.contacts || [];
        if (!Array.isArray(contactsList)) {
          console.error('[Contacts] Invalid contacts data:', contactsList);
          setContacts([]);
        } else {
          console.log('[Contacts] Setting contacts:', contactsList);
          setContacts(contactsList);
        }
      } else {
        const error = contactsResult?.error || 'Unknown error';
        console.error('[Contacts] Failed to get contacts:', error);
        setContacts([]);
      }

      // 处理邀请数据
      if (invitationsResult && invitationsResult.success) {
        const invitationsList = invitationsResult.invitations || [];
        if (!Array.isArray(invitationsList)) {
          console.error('[Contacts] Invalid invitations data:', invitationsList);
          setInvitations([]);
        } else {
          console.log('[Contacts] Setting invitations:', invitationsList);
          setInvitations(invitationsList);
        }
      } else {
        const error = invitationsResult?.error || 'Unknown error';
        console.error('[Contacts] Failed to get invitations:', error);
        setInvitations([]);
      }

      setError(null);
    } catch (error) {
      console.error('[Contacts] Load data failed:', error);
      setContacts([]);
      setInvitations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async (address: string, nickname: string) => {
    try {
      // 基本验证
      if (!address || !nickname) {
        throw new Error('Address and nickname are required');
      }

      // 验证地址格式
      if (!/^[a-zA-Z0-9_-]{43}$/.test(address)) {
        throw new Error('Invalid Arweave address format');
      }

      // 验证昵称长度
      if (nickname.length > 32) {
        throw new Error('Nickname is too long (max 32 characters)');
      }

      console.log('[Contacts] Sending invitation to:', address, 'with nickname:', nickname);
      const result = await AOProcess.sendInvitation(address, nickname);
      console.log('[Contacts] Send invitation result:', result);

      if (result.success) {
        await loadData();
        setIsAddModalOpen(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('[Contacts] Failed to add contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to add contact');
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
    interval = setInterval(refreshData, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAcceptInvitation = async (invitation: ContactInvitation) => {
    try {
      const result = await AOProcess.acceptInvitation(
        invitation.from,
        `User-${invitation.from.slice(0, 6)}`
      );
      if (result.success) {
        await loadData();
        setError(null);
      } else {
        setError(result.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Accept invitation error:', error);
      setError('Failed to accept invitation');
    }
  };

  const handleRejectInvitation = async (invitation: ContactInvitation) => {
    try {
      const result = await AOProcess.rejectInvitation(invitation.from);
      if (result.success) {
        await loadData();
        setError(null);
      } else {
        setError(result.error || 'Failed to reject invitation');
      }
    } catch (error) {
      console.error('Reject invitation error:', error);
      setError('Failed to reject invitation');
    }
  };

  return (
    <div className="w-80 border-r border-gray-200 h-full flex flex-col">
      {/* Add Contact Button */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded flex items-center justify-center"
        >
          <span className="mr-2">+</span> Add Contact
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-100 text-red-600">
          {error}
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">Pending Invitations</h3>
          {invitations.map((invitation) => (
            <div
              key={`${invitation.from}-${invitation.timestamp}`}
              className="mb-2 p-2 bg-gray-50 rounded"
            >
              <div className="text-sm">{invitation.fromNickname}</div>
              <div className="text-xs text-gray-500 mb-2">{invitation.from}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptInvitation(invitation)}
                  className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleRejectInvitation(invitation)}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading contacts...</div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No contacts yet
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.address}
              className={`p-4 border-b border-gray-200 hover:bg-gray-50 ${
                selectedContact?.address === contact.address ? 'bg-gray-50' : ''
              }`}
            >
              <div 
                className="cursor-pointer"
                onClick={() => onSelectContact(contact)}
              >
                <div className="font-semibold">{contact.nickname}</div>
                <div className="text-sm text-gray-500">{contact.address}</div>
              </div>
              {selectedContact?.address === contact.address && (
                <button
                  onClick={() => onStartChat(contact)}
                  disabled={isCreatingChat}
                  className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-1 px-2 rounded disabled:opacity-50"
                >
                  {isCreatingChat ? 'Creating Chat...' : 'Start Chat'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddContact}
      />
    </div>
  );
} 