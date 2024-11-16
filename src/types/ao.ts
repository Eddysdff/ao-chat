export interface Contact {
  address: string;
  nickname: string;
  status: 'online' | 'offline';
  lastSeen?: number;
}

export interface ContactInvitation {
  from: string;
  fromNickname: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface ProcessResult {
  success: boolean;
  error?: string;
  data?: any;
  contacts?: Contact[];
  invitations?: ContactInvitation[];
  messages?: ChatMessage[];
  session?: ChatSession;
}

export interface ChatMessage {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  encrypted?: boolean;
}

export interface ChatSession {
  participants: [string, string];
  lastMessage?: ChatMessage;
  unreadCount?: number;
  lastActivity: number;
}

export interface ChatState {
  contacts: { [address: string]: Contact };
  invitations: { [address: string]: ContactInvitation[] };
  sessions: { [sessionId: string]: ChatSession };
  messages: { [sessionId: string]: ChatMessage[] };
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