export interface Contact {
  address: string;
  nickname: string;
}

export interface ContactInvitation {
  from: string;
  to: string;
  fromNickname: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface ChatInvitation {
  processId: string;
  from: string;
  fromNickname: string;
  timestamp: number;
}

export interface ProcessResult {
  success: boolean;
  error?: string;
  data?: any;
  contacts?: Contact[];
  invitations?: ContactInvitation[];
  chatInvitations?: ChatInvitation[];
}

export interface ChatRoom {
  processId: string;
  participants: string[];
  messages: ChatMessage[];
}

export interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}