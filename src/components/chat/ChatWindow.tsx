'use client';

import { useEffect, useRef, useState } from 'react';
import { AOProcess } from '@/lib/ao-process';
import { Contact, ChatMessage } from '@/types/ao';
import { Encryption } from '@/lib/encryption';
import VideoCallModal from '@/components/video/VideoCallModal';
import { WebRTCService } from '@/lib/webrtc';

interface ChatWindowProps {
  contact: Contact;
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
}

export default function ChatWindow({
  contact,
  messages,
  onSendMessage
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    
    try {
      setIsSending(true);
      await onSendMessage(newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('[Chat] Send message failed:', error);
    } finally {
      setIsSending(false);
    }
  };

  // ... 保留其他现有代码 ...
} 