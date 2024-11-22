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

        console.log('[AO] Encoded message data:', data);

        const signer = createDataItemSigner(window.arweaveWallet);
        const encodedData = new TextEncoder().encode(JSON.stringify(data));
        const from = await window.arweaveWallet.getActiveAddress();

        const result = await client.message({
          process: targetProcess,
          tags: [
            { name: 'Action', value: action },
            { name: 'From', value: from }
          ],
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
              return result.Output;
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

  static async addUser(): Promise<ProcessResult> {
    try {
      const data = {
        timestamp: Date.now()
      };

      const result = await this.sendMessageWithRetry('AddUser', data);
      return result;
    } catch (error) {
      console.error('[AO] Add user error:', error);
      throw error;
    }
  }

  static async sendInvitation(toAddress: string): Promise<ProcessResult> {
    try {
      console.log('[AO] Sending invitation to:', toAddress);
      
      const data = {
        to: toAddress
      };

      console.log('[AO] Data to be sent:', data);

      const result = await this.sendMessageWithRetry('SendInvitation', data);
      console.log('[AO] SendInvitation response:', result);
      return result;
    } catch (error) {
      console.error('[AO] Send invitation error:', error);
      throw error;
    }
  }

  static async acceptInvitation(from: string): Promise<ProcessResult> {
    try {
      const data = {
        from,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('AcceptInvitation', data);
      return result;
    } catch (error) {
      console.error('[AO] Accept invitation error:', error);
      throw error;
    }
  }

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
      return result;
    } catch (error) {
      console.error('[AO] Get messages error:', error);
      throw error;
    }
  }

  static async getContacts(): Promise<ProcessResult> {
    try {
      const data = {
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('GetContacts', data);
      return result;
    } catch (error) {
      console.error('[AO] Get contacts error:', error);
      throw error;
    }
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    try {
      const data = {
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('GetPendingInvitations', data);
      return result;
    } catch (error) {
      console.error('[AO] Get pending invitations error:', error);
      throw error;
    }
  }
}

export interface User {
  timestamp: number;
}

export interface Contact {
  address: string;
}

export interface Message {
  sender: string;
  content: string;
  timestamp: number;
  encrypted: boolean;
}

export interface Invitation {
  from: string;
  timestamp: number;
}

export interface ChatSession {
  messages: Message[];
}