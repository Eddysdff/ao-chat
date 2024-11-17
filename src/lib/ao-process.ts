import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { ProcessResult } from '@/types/ao';
import { getConfig } from '@/config';

const config = getConfig();
const PROCESS_ID = config.ao.processId;

const client = connect({
  MU_URL: config.ao.endpoints.MU_URL,
  CU_URL: config.ao.endpoints.CU_URL,
});

export class AOProcess {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 5000;

  private static async sendMessageWithRetry(
    action: string,
    data: any = {},
    targetProcess: string = PROCESS_ID,
    maxRetries: number = 3
  ): Promise<ProcessResult> {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`[AO] Sending message attempt ${i + 1}:`, {
          action,
          data,
          targetProcess
        });

        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        const messageData = typeof data === 'string' 
          ? data 
          : JSON.stringify(data);

        console.log('[AO] Encoded message data:', messageData);

        const signer = createDataItemSigner(window.arweaveWallet);
        const encodedData = new TextEncoder().encode(messageData);

        const result = await client.message({
          process: targetProcess,
          tags: [{ name: 'Action', value: action }],
          data: encodedData,
          signer,
        });

        console.log(`[AO] Raw response:`, result);

        if (result && typeof result === 'object') {
          if ('Output' in result) {
            if (typeof result.Output === 'string') {
              try {
                return JSON.parse(result.Output);
              } catch (error) {
                console.error('[AO] Failed to parse Output string:', error);
              }
            }
            else if (result.Output && typeof result.Output === 'object') {
              if ('data' in result.Output) {
                try {
                  if (typeof result.Output.data === 'string') {
                    const parsedData = JSON.parse(result.Output.data);
                    console.log('[AO] Parsed Output.data:', parsedData);
                    return parsedData;
                  }
                  else if (typeof result.Output.data === 'object') {
                    return result.Output.data;
                  }
                } catch (error) {
                  console.error('[AO] Failed to parse Output.data:', error);
                }
              }
              if ('success' in result.Output) {
                return result.Output;
              }
            }
          }
          if ('success' in result) {
            return result;
          }
        }

        return {
          success: true,
          data: result
        };

      } catch (error) {
        console.warn(`[AO] Attempt ${i + 1} failed:`, error);
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }
    
    return {
      success: false,
      error: lastError instanceof Error ? lastError.message : 'Unknown error'
    };
  }

  // 用户管理
  static async addUser(
    name: string,
    avatar: string = ""
  ): Promise<ProcessResult> {
    try {
      const data = {
        name,
        avatar,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('AddUser', data);
      console.log('[AO] Add user result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Add user error:', error);
      throw error;
    }
  }

  // 联系人管理
  static async sendInvitation(
    toAddress: string,
    fromNickname: string
  ): Promise<ProcessResult> {
    try {
      const data = {
        to: toAddress,
        fromNickname,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('SendInvitation', data);
      console.log('[AO] Send invitation result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Send invitation error:', error);
      throw error;
    }
  }

  static async acceptInvitation(
    fromAddress: string,
    nickname: string
  ): Promise<ProcessResult> {
    try {
      const data = {
        from: fromAddress,
        nickname,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('AcceptInvitation', data);
      console.log('[AO] Accept invitation result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Accept invitation error:', error);
      throw error;
    }
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    try {
      const result = await this.sendMessageWithRetry('GetPendingInvitations');
      console.log('[AO] Get pending invitations result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Get pending invitations error:', error);
      throw error;
    }
  }

  // 消息管理
  static async sendMessage(
    receiver: string,
    content: string,
    encrypted: boolean = false
  ): Promise<ProcessResult> {
    try {
      const data = {
        receiver,
        content,
        encrypted,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('SendMessage', data);
      console.log('[AO] Send message result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Send message error:', error);
      throw error;
    }
  }

  static async getMessages(otherAddress: string): Promise<ProcessResult> {
    try {
      const data = {
        otherAddress,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('GetMessages', data);
      console.log('[AO] Get messages result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Get messages error:', error);
      throw error;
    }
  }

  static async updateMessageStatus(
    messageId: string,
    sessionId: string,
    status: 'delivered' | 'read'
  ): Promise<ProcessResult> {
    try {
      const data = {
        messageId,
        sessionId,
        status,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('UpdateMessageStatus', data);
      console.log('[AO] Update message status result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Update message status error:', error);
      throw error;
    }
  }

  // 联系人查询
  static async getContacts(): Promise<ProcessResult> {
    try {
      const result = await this.sendMessageWithRetry('GetContacts');
      console.log('[AO] Get contacts result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Get contacts error:', error);
      throw error;
    }
  }
}

// 类型定义
export interface User {
  name: string;
  avatar?: string;
  timestamp: number;
  status: 'active' | 'offline';
}

export interface Contact {
  nickname: string;
  timestamp: number;
  status: 'active' | 'blocked';
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
  fromNickname: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChatSession {
  messages: Message[];
  last_read: {
    [address: string]: string;
  };
}