import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { result } from '@permaweb/aoconnect';
import { 
  ProcessResult, 
  ApiResponse, 
  Message as ChatMessage, 
  Contact as ContactType, 
  Invitation as InvitationType, 
  ChatSession as ChatSessionType,
  ContactInvitation
} from '@/types/ao';
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
  private static prepareData(data: any): string {
    try {
      // 直接将数据转换为 JSON 字符串
      return JSON.stringify(data);
    } catch (error) {
      console.error('[AO] Error preparing data:', error);
      throw error;
    }
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
                const parsedData = typeof responseMessage.Data === 'string' 
                  ? JSON.parse(responseMessage.Data) 
                  : responseMessage.Data;
                
                console.log(`[AO] Parsed data for ${action}:`, parsedData);
                
                resolve(parsedData);
              } catch (error) {
                console.error('[AO] Error parsing response data:', error);
                reject(error);
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
    let lastError: Error | unknown;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const encodedData = this.prepareData(data);
        
        console.log(`[AO] Sending ${action} request:`, {
          process: targetProcess,
          action,
          data,
          encodedData
        });

        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        const signer = createDataItemSigner(window.arweaveWallet);

        const messageResult = await client.message({
          process: targetProcess,
          tags: [
            { name: 'Action', value: action },
            { name: 'Content-Type', value: 'application/json' }
          ],
          data: encodedData,
          signer,
        });

        console.log(`[AO] Message sent, result:`, messageResult);

        if (ACTIONS_NEED_RESPONSE.includes(action)) {
          try {
            const response = await this.waitForResponse(messageResult, action);
            console.log(`[AO] ${action} response received:`, response);
            return response;
          } catch (error: unknown) {
            if (error instanceof Error && error.message === 'Response timeout' && i < maxRetries - 1) {
              console.log(`[AO] ${action} response timeout, retrying...`);
              continue;
            }
            throw error;
          }
        } else {
          return {
            success: true,
            data: {
              output: messageResult
            }
          };
        }

      } catch (error: unknown) {
        console.error(`[AO] ${action} attempt ${i + 1} failed:`, error);
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }

    return {
      success: false,
      error: lastError instanceof Error ? lastError.message : 'Max retries reached'
    };
  }

  static async addUser(nickname?: string): Promise<ProcessResult> {
    try {
      const address = await window.arweaveWallet.getActiveAddress();
      const userNickname = nickname || `User_${address.slice(0, 6)}`;
      
      // 发送 AddUser 请求到后端
      const data = {
        nickname: userNickname,
        timestamp: Math.floor(Date.now() / 1000)
      };

      console.log('[AO] Adding user:', data);
      const result = await this.sendMessageWithRetry('AddUser', data);
      console.log('[AO] AddUser result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Add user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add user'
      };
    }
  }

  static async sendInvitation(address: string): Promise<ProcessResult> {
    try {
      const data = {
        to: address
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

      console.log('[AO] Getting messages with:', otherAddress);
      const result = await this.sendMessageWithRetry('GetMessages', data);
      console.log('[AO] GetMessages raw result:', result);

      // 检查并转换消息格式
      if (result.success && result.data?.messages) {
        const formattedMessages = result.data.messages.map((msg: any) => ({
          id: String(msg.timestamp),
          sender: msg.sender,
          content: msg.content,
          timestamp: msg.timestamp,
          data: msg.data || {},
        }));

        console.log('[AO] Formatted messages:', formattedMessages);

        return {
          success: true,
          data: {
            messages: formattedMessages
          }
        };
      }

      return {
        success: true,
        data: {
          messages: []
        }
      };
    } catch (error) {
      console.error('[AO] Get messages error:', error);
      throw error;
    }
  }

  // 添加类型守卫
  private static hasContacts(data: any): data is { contacts: Array<{ address: string; nickname?: string }> } {
    return data && Array.isArray(data.contacts);
  }

  static async getContacts(): Promise<ProcessResult> {
    try {
      const data = {
        timestamp: Math.floor(Date.now() / 1000)
      };

      console.log('[AO] Getting contacts...');
      const result = await this.sendMessageWithRetry('GetContacts', data);
      console.log('[AO] GetContacts raw result:', result);

      // 检查返回的数据格式
      if (result && result.handler === 'GetContacts') {
        console.log('[AO] Found contacts in response');
        
        // 从 state_contacts 中获取联系人列表
        const stateContacts = result.state_contacts || {};
        const contacts = result.contacts || [];
        
        // 合并联系人信息
        const formattedContacts = Object.keys(stateContacts).map(address => {
          // 查找对应的联系人详细信息
          const contactInfo = contacts.find(c => c.address === address) || { address };
          
          return {
            address: address,
            name: contactInfo.nickname || `User-${address.slice(0, 6)}`,
            nickname: contactInfo.nickname || `User-${address.slice(0, 6)}`,
            status: 'offline' as const,
            unread: 0
          };
        });

        console.log('[AO] Formatted contacts:', formattedContacts);

        return {
          success: true,
          data: {
            contacts: formattedContacts
          }
        };
      }

      console.log('[AO] No valid contacts found in response');
      return {
        success: true,
        data: {
          contacts: []
        }
      };
    } catch (error) {
      console.error('[AO] Get contacts error:', error);
      throw error;
    }
  }

  // 添加类型守卫
  private static hasInvitations(data: any): data is { invitations: Array<ContactInvitation> } {
    return data && Array.isArray(data.invitations);
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    try {
      // 简化发送的数据
      const data = {
        timestamp: Math.floor(Date.now() / 1000)  // 使用整数时间戳
      };

      console.log('[AO] Getting pending invitations...');
      return await this.sendMessageWithRetry('GetPendingInvitations', data);
    } catch (error) {
      console.error('[AO] Get pending invitations error:', error);
      throw error;
    }
  }
}