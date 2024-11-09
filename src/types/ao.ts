export interface ContactInvitation {
  from: string;
  to: string;
  fromNickname: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface Contact {
  address: string;
  nickname: string;
}

export interface ProcessResult {
  success: boolean;
  error?: string;
  invitation?: ContactInvitation;
  contacts?: Contact[];
  invitations?: ContactInvitation[];
} 

export interface ChatRoom {
  processId: string;
  participants: string[];
  createdAt: number;
}

export interface ChatInvitation {
  processId: string;
  from: string;
  fromNickname: string;
  timestamp: number;
}