'use client';

import { useEffect, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ContactInvitation } from '@/types/ao';
import Notification from '../common/Notification';

interface ContactsListProps {
  onSelectContact: (contact: Contact) => void;
  onStartChat: (contact: Contact) => void;
  selectedContact: Contact | null;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">Add New Contact</h2>
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AR Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
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
              {isSubmitting ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactsList({
  onSelectContact,
  onStartChat,
  selectedContact
}: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitations, setInvitations] = useState<ContactInvitation[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadData = async (retryCount = 0) => {
    try {
      if (retryCount === 0) {
        setIsLoading(true);
      }
      console.log('[Contacts] Loading data...');
      
      // 获取邀请
      const invitationsResult = await AOProcess.getPendingInvitations();
      console.log('[Contacts] Raw invitations result:', invitationsResult);

      if (invitationsResult.success) {
        if (invitationsResult.Output?.data) {
          try {
            const parsedData = JSON.parse(invitationsResult.Output.data);
            console.log('[Contacts] Parsed invitations data:', parsedData);
            setInvitations(parsedData.invitations || []);
          } catch (error) {
            console.error('[Contacts] Failed to parse invitations data:', error);
            setInvitations([]);
          }
        } else {
          console.log('[Contacts] No invitations data in Output');
          setInvitations([]);
        }
      }

      // 获取联系人
      const contactsResult = await AOProcess.getContacts();
      console.log('[Contacts] Raw contacts result:', contactsResult);

      if (contactsResult.success) {
        if (contactsResult.Output?.data) {
          try {
            const parsedData = JSON.parse(contactsResult.Output.data);
            console.log('[Contacts] Parsed contacts data:', parsedData);
            setContacts(parsedData.contacts || []);
          } catch (error) {
            console.error('[Contacts] Failed to parse contacts data:', error);
          }
        }
      }

      setError(null);
    } catch (error) {
      console.error('[Contacts] Load data failed:', error);
      if (error instanceof Error && error.message.includes('network') && retryCount < 3) {
        setTimeout(() => loadData(retryCount + 1), 1000 * Math.pow(2, retryCount));
        return;
      }
      setError('Failed to load contacts and invitations');
    } finally {
      if (retryCount === 0) {
        setIsLoading(false);
      }
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

  return (
    <div className="w-80 border-r border-gray-200 h-full flex flex-col">
      {/* Add Contact Button */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded flex items-center justify-center transition-colors duration-200"
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
              className="mb-2 p-2 bg-gray-50 rounded transform transition-all duration-300 hover:scale-102 hover:shadow-md"
            >
              <div className="text-sm font-medium">{invitation.fromNickname}</div>
              <div className="text-xs text-gray-500 mb-2">{invitation.from}</div>
              <button
                onClick={() => handleAcceptInvitation(invitation)}
                className="w-full text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors duration-200"
              >
                Accept
              </button>
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
              className={`
                p-4 border-b border-gray-200
                hover:bg-gray-50 transition-colors duration-200
                ${selectedContact?.address === contact.address ? 'bg-gray-50' : ''}
              `}
              onClick={() => onSelectContact(contact)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{contact.nickname}</div>
                  <div className="text-sm text-gray-500">{contact.address}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  contact.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              </div>
              {selectedContact?.address === contact.address && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChat(contact);
                  }}
                  className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-1 px-2 rounded transition-colors duration-200"
                >
                  Start Chat
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
        onSubmit={handleAddContact}
        isSubmitting={false}
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