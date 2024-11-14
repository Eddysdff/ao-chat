'use client';

import { useEffect, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ContactInvitation } from '@/types/ao';
import AddContactModal from './AddContactModal';
import Notification from '../common/Notification';

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

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [processingInvitations, setProcessingInvitations] = useState<string[]>([]);
  const [newInvitationCount, setNewInvitationCount] = useState(0);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[Contacts] Loading data...');
      
      const [contactsResult, invitationsResult] = await Promise.all([
        AOProcess.getContacts(),
        AOProcess.getPendingInvitations()
      ]);

      if (contactsResult?.success) {
        const contactsList = Array.isArray(contactsResult.contacts) 
          ? contactsResult.contacts 
          : [];
        setContacts(contactsList);
      }

      if (invitationsResult?.success) {
        const invitationsList = Array.isArray(invitationsResult.invitations)
          ? invitationsResult.invitations
          : [];
        setInvitations(invitationsList);
        
        if (invitationsList.length > 0) {
          setNewInvitationCount(invitationsList.length);
          setNotification({
            type: 'info',
            message: `You have ${invitationsList.length} new contact ${
              invitationsList.length === 1 ? 'invitation' : 'invitations'
            }`
          });
        }
      }

      setError(null);
    } catch (error) {
      console.error('[Contacts] Load data failed:', error);
      setError('Failed to load contacts and invitations');
    } finally {
      setIsLoading(false);
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

  const handleAcceptInvitation = async (invitation: ContactInvitation) => {
    try {
      setProcessingInvitations(prev => [...prev, invitation.from]);
      
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
        setNotification({
          type: 'error',
          message: result.error || 'Failed to accept invitation'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to accept invitation'
      });
    } finally {
      setProcessingInvitations(prev => prev.filter(id => id !== invitation.from));
    }
  };

  const handleRejectInvitation = async (invitation: ContactInvitation) => {
    try {
      setProcessingInvitations(prev => [...prev, invitation.from]);
      
      const result = await AOProcess.rejectInvitation(invitation.from);
      
      if (result.success) {
        setNotification({
          type: 'success',
          message: 'Invitation rejected'
        });
        await loadData();
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to reject invitation'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to reject invitation'
      });
    } finally {
      setProcessingInvitations(prev => prev.filter(id => id !== invitation.from));
    }
  };

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
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptInvitation(invitation)}
                  disabled={processingInvitations.includes(invitation.from)}
                  className={`
                    text-xs px-2 py-1 rounded transition-all duration-200
                    ${processingInvitations.includes(invitation.from)
                      ? 'bg-gray-400'
                      : 'bg-green-500 hover:bg-green-600'
                    }
                    text-white
                  `}
                >
                  {processingInvitations.includes(invitation.from)
                    ? 'Processing...'
                    : 'Accept'}
                </button>
                <button
                  onClick={() => handleRejectInvitation(invitation)}
                  disabled={processingInvitations.includes(invitation.from)}
                  className={`
                    text-xs px-2 py-1 rounded transition-all duration-200
                    ${processingInvitations.includes(invitation.from)
                      ? 'bg-gray-400'
                      : 'bg-red-500 hover:bg-red-600'
                    }
                    text-white
                  `}
                >
                  {processingInvitations.includes(invitation.from)
                    ? 'Processing...'
                    : 'Reject'}
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
              className={`
                p-4 border-b border-gray-200
                hover:bg-gray-50 transition-colors duration-200
                ${selectedContact?.address === contact.address ? 'bg-gray-50' : ''}
              `}
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
                  className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-1 px-2 rounded disabled:opacity-50 transition-colors duration-200"
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
        onAdd={async (address, nickname) => {
          try {
            await AOProcess.sendInvitation(address, nickname);
            setNotification({
              type: 'success',
              message: 'Invitation sent successfully'
            });
            setIsAddModalOpen(false);
          } catch (error) {
            setNotification({
              type: 'error',
              message: error instanceof Error ? error.message : 'Failed to send invitation'
            });
          }
        }}
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