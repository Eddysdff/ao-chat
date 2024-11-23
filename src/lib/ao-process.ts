import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { ProcessResult } from '@/types/ao';
import { getConfig } from '@/config';

const config = getConfig();
const PROCESS_ID = config.ao.processId;

// 定义需要等待响应的操作
const ACTIONS_NEED_RESPONSE = ['GetPendingInvitations', 'GetContacts', 'GetMessages'];

const client = connect({
  MU_URL: config.ao.endpoints.MU_URL,
  CU_URL: config.ao.endpoints.CU_URL,
});

export class AOProcess {
  private static prepareData(data: any): Uint8Array {
    const dataString = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(dataString);
  }

  private static async waitForResponse(requestId: string, action: string, timeout: number = 10000): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      
      const messageHandler = (event: any) => {
        if (!event.messages) return;
        
        for (const message of event.messages) {
          // 检查是否是对应的响应消息
          const isMatchingResponse = message.Tags?.some(tag => 
            tag.name === 'Action' && tag.value === `${action}Result`
          );

          if (isMatchingResponse && message.Data) {
            console.log(`[AO] Found ${action} response:`, message);
            clearTimeout(timeoutId);
            window.removeEventListener('ao-messages', messageHandler);
            
            try {
              const data = typeof message.Data === 'string' 
                ? JSON.parse(message.Data) 
                : message.Data;
              resolve(data);
            } catch (error) {
              console.error('[AO] Error parsing response data:', error);
              resolve(message.Data);
            }
            return;
          }
        }
      };

      window.addEventListener('ao-messages', messageHandler);

      timeoutId = setTimeout(() => {
        window.removeEventListener('ao-messages', messageHandler);
        reject(new Error('Response timeout'));
      }, timeout);
    });
  }

  private static async sendMessageWithRetry(
    action: string,
    data: any,
    targetProcess: string = PROCESS_ID,
    maxRetries: number = 3
  ): Promise<ProcessResult> {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const encodedData = this.prepareData(data);
        const requestId = crypto.randomUUID();
        
        console.log(`[AO] Sending ${action} request:`, {
          requestId,
          data
        });

        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        const signer = createDataItemSigner(window.arweaveWallet);

        // 发送请求
        const result = await client.message({
          process: targetProcess,
          tags: [
            { name: 'Action', value: action },
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Reference', value: requestId }
          ],
          data: encodedData,
          signer,
        });

        console.log(`[AO] ${action} request sent:`, result);

        // 只有需要等待响应的操作才等待
        if (ACTIONS_NEED_RESPONSE.includes(action)) {
          try {
            const response = await this.waitForResponse(requestId, action);
            console.log(`[AO] ${action} response received:`, response);
            return response;
          } catch (error) {
            if (error.message === 'Response timeout' && i < maxRetries - 1) {
              console.log(`[AO] ${action} response timeout, retrying...`);
              continue;
            }
            throw error;
          }
        } else {
          // 写入操作直接返回发送结果
          return {
            success: true,
            data: result.data
          };
        }

      } catch (error) {
        console.error(`[AO] ${action} attempt ${i + 1} failed:`, error);
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries reached'
    };
  }

  static async addUser(): Promise<ProcessResult> {
    try {
      const data = {
        timestamp: Date.now()
      };

      return await this.sendMessageWithRetry('AddUser', data);
    } catch (error) {
      console.error('[AO] Add user error:', error);
      throw error;
    }
  }

  static async sendInvitation(toAddress: string): Promise<ProcessResult> {
    try {
      const data = {
        to: toAddress
      };
      
      console.log('[AO] Sending invitation data:', data);
      return await this.sendMessageWithRetry('SendInvitation', data);
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

      return await this.sendMessageWithRetry('AcceptInvitation', data);
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

      return await this.sendMessageWithRetry('SendMessage', data);
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

      return await this.sendMessageWithRetry('GetMessages', data);
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

      return await this.sendMessageWithRetry('GetContacts', data);
    } catch (error) {
      console.error('[AO] Get contacts error:', error);
      throw error;
    }
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    try {
      const data = {
        timestamp: Date.now()
      };

      console.log('[AO] Getting pending invitations...');
      const result = await this.sendMessageWithRetry('GetPendingInvitations', data);
      console.log('[AO] GetPendingInvitations result:', result);

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            invitations: result.data.invitations || []
          }
        };
      }

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