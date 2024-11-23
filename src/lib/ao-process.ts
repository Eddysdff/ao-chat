import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { result } from '@permaweb/aoconnect';
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

  private static async waitForResponse(messageId: string, action: string, timeout: number = 10000): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      
      const checkResult = async () => {
        try {
          const { Messages, Error } = await result({
            message: messageId,
            process: PROCESS_ID
          });

          if (Error) {
            console.error(`[AO] Process error:`, Error);
            return;
          }

          if (Messages && Messages.length > 0) {
            const responseMessage = Messages.find(msg => msg.Data);

            if (responseMessage && responseMessage.Data) {
              console.log(`[AO] Found raw response for ${action}:`, responseMessage.Data);
              clearTimeout(timeoutId);
              clearInterval(pollInterval);
              
              try {
                let parsedData;
                if (typeof responseMessage.Data === 'string') {
                  parsedData = JSON.parse(responseMessage.Data);
                } else {
                  parsedData = responseMessage.Data;
                }
                
                console.log(`[AO] Parsed data for ${action}:`, parsedData);

                if (parsedData.success !== undefined) {
                  resolve(parsedData);
                } else if (parsedData.handler === 'GetContacts' && Array.isArray(parsedData.contacts)) {
                  resolve({
                    success: true,
                    data: {
                      contacts: parsedData.contacts
                    }
                  });
                } else if (parsedData.handler && parsedData.response) {
                  resolve(parsedData.response);
                } else {
                  resolve({
                    success: false,
                    error: 'Invalid response format',
                    data: parsedData
                  });
                }
                return;
              } catch (error) {
                console.error('[AO] Error parsing response data:', error);
                resolve({
                  success: false,
                  error: 'Failed to parse response data',
                  data: responseMessage.Data
                });
              }
            }
          }
        } catch (error) {
          console.error('[AO] Error checking result:', error);
        }
      };

      const pollInterval = setInterval(checkResult, 2000);
      checkResult();

      timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
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
        
        console.log(`[AO] Sending ${action} request:`, {
          data
        });

        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        const signer = createDataItemSigner(window.arweaveWallet);

        // 发送请求
        const messageResult = await client.message({
          process: targetProcess,
          tags: [
            { name: 'Action', value: action },
            { name: 'Content-Type', value: 'application/json' }
          ],
          data: encodedData,
          signer,
        });

        console.log(`[AO] ${action} request sent with ID:`, messageResult);

        // 只有需要等待响应的操作才等待
        if (ACTIONS_NEED_RESPONSE.includes(action)) {
          try {
            const response = await this.waitForResponse(messageResult, action);
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
            data: messageResult
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

      console.log('[AO] Getting contacts...');
      const result = await this.sendMessageWithRetry('GetContacts', data);
      console.log('[AO] GetContacts raw result:', result);

      if (result.success && result.data?.contacts) {
        const formattedContacts = result.data.contacts.map(contact => ({
          address: contact.address,
          nickname: contact.nickname || `User-${contact.address.slice(0, 6)}`
        }));

        return {
          success: true,
          data: {
            contacts: formattedContacts
          }
        };
      }

      return result;
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