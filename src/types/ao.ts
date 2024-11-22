export interface ProcessResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface User {
  name: string;
  avatar?: string;
  timestamp: number;
  status: 'active' | 'offline';
}

export interface Contact {
  address: string;
  nickname: string;
  name: string;
  avatar?: string;
  status: 'active' | 'blocked';
  unread: number;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  encrypted?: boolean;
}

export interface Invitation {
  from: string;
  fromNickname: string;
  name: string;
  avatar?: string;
  timestamp: number;
}

export interface ChatSession {
  participants: [string, string];
  lastMessage?: Message;
  unreadCount?: number;
  lastActivity: number;
}

export interface ChatState {
  contacts: { [address: string]: Contact };
  invitations: { [address: string]: Invitation[] };
  sessions: { [sessionId: string]: ChatSession };
  messages: { [sessionId: string]: Message[] };
}

export interface UserStatus {
  address: string;
  status: 'online' | 'offline';
  timestamp: number;
}

export interface MessageNotification {
  type: 'new-message' | 'message-read' | 'message-delivered';
  messageId: string;
  sessionId: string;
  timestamp: number;
}

export const generateSessionId = (addr1: string, addr2: string): string => {
  const sortedAddrs = [addr1, addr2].sort();
  return `${sortedAddrs[0]}_${sortedAddrs[1]}`;
};