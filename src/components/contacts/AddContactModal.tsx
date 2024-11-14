'use client';

import { useState } from 'react';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (address: string, nickname: string) => Promise<void>;
}

export default function AddContactModal({ isOpen, onClose, onAdd }: AddContactModalProps) {
  const [address, setAddress] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateInput = () => {
    if (!address) {
      setError('Address is required');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]{43}$/.test(address)) {
      setError('Invalid Arweave address format');
      return false;
    }
    if (!nickname) {
      setError('Nickname is required');
      return false;
    }
    if (nickname.length > 32) {
      setError('Nickname is too long (max 32 characters)');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateInput()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onAdd(address.trim(), nickname.trim());
      setAddress('');
      setNickname('');
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  };

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