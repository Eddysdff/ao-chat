'use client';

import { useEffect, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ContactInvitation, ChatRoom } from '@/types/ao';
import AddContactModal from './AddContactModal';
import Notification from '../common/Notification';

interface ContactsListProps {
  onSelectChat: (chatRoom: ChatRoom) => void;
}

export default function ContactsList({ onSelectChat }: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitations, setInvitations] = useState<ContactInvitation[]>([]);
  const [chatInvitations, setChatInvitations] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // 加载联系人和邀请
  const loadData = async () => {
    try {
      const [contactsResult, invitationsResult] = await Promise.all([
        AOProcess.getContacts(),
        AOProcess.getPendingInvitations()
      ]);

      if (contactsResult.contacts) {
        setContacts(contactsResult.contacts);
      }
      if (invitationsResult.invitations) {
        setInvitations(invitationsResult.invitations);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showNotification('Failed to load contacts and invitations', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddContact = async (address: string, nickname: string) => {
    try {
      const result = await AOProcess.sendInvitation(address, nickname);
      if (result.success) {
        showNotification('Invitation sent successfully', 'success');
        await loadData();
      } else {
        showNotification(result.error || 'Failed to send invitation', 'error');
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
      showNotification('Failed to send invitation', 'error');
    }
  };

  const handleStartChat = async (contact: Contact) => {
    try {
      const result = await AOProcess.createChatRoom(contact.address);
      if (result.success) {
        showNotification('Chat invitation sent', 'success');
      } else {
        showNotification(result.error || 'Failed to create chat room', 'error');
      }
    } catch (error) {
      console.error('Failed to create chat room:', error);
      showNotification('Failed to create chat room', 'error');
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

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">Pending Invitations</h3>
          {invitations.map((invitation) => (
            <div key={`${invitation.from}-${invitation.timestamp}`} className="mb-2 p-2 bg-gray-50 rounded">
              <div className="text-sm">{invitation.fromNickname}</div>
              <div className="text-xs text-gray-500 mb-2">{invitation.from}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => {/* TODO: Implement accept */}}
                  className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                >
                  Accept
                </button>
                <button
                  onClick={() => {/* TODO: Implement reject */}}
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
        {contacts.length === 0 ? (
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
                onClick={() => setSelectedContact(contact)}
              >
                <div className="font-semibold">{contact.nickname}</div>
                <div className="text-sm text-gray-500">{contact.address}</div>
              </div>
              {selectedContact?.address === contact.address && (
                <button
                  onClick={() => handleStartChat(contact)}
                  className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-1 px-2 rounded"
                >
                  Start Chat
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Chat Invitations */}
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

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddContact}
      />

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
} 