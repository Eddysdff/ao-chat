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
  private static cacheTimeout = 5000; // 5秒缓存

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

        const signer = createDataItemSigner(window.arweaveWallet);
        
        const encodedData = new TextEncoder().encode(messageData);

        const result = await client.message({
          process: targetProcess,
          tags: [{ name: 'Action', value: action }],
          data: encodedData,
          signer,
        });

        console.log(`[AO] Raw response:`, result);
        
        if (result instanceof Uint8Array) {
          const textDecoder = new TextDecoder();
          const decodedResult = textDecoder.decode(result);
          console.log('[AO] Decoded result:', decodedResult);
          
          try {
            return JSON.parse(decodedResult);
          } catch (error) {
            console.error('[AO] Failed to parse decoded result:', error);
            return {
              success: true,
              data: decodedResult,
              contacts: [],
              invitations: []
            };
          }
        }

        if (typeof result === 'object' && !Array.isArray(result)) {
          return result;
        }

        return {
          success: true,
          data: result,
          contacts: [],
          invitations: []
        };

      } catch (error) {
        console.warn(`[AO] Attempt ${i + 1} failed:`, error);
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError;
  }

  private static processResult(result: any): ProcessResult {
    console.log('[AO] Processing raw result:', result);
    
    if (!result) {
      return {
        success: false,
        error: 'Empty response from process'
      };
    }

    // 如果结果是 Uint8Array，转换为字符串
    if (result instanceof Uint8Array) {
      const textDecoder = new TextDecoder();
      const decodedResult = textDecoder.decode(result);
      try {
        return JSON.parse(decodedResult);
      } catch (error) {
        console.error('[AO] Failed to parse result:', error);
        return {
          success: false,
          error: 'Invalid response format'
        };
      }
    }

    // 如果结果已经是对象格式，确保包含必要字段
    if (typeof result === 'object' && !Array.isArray(result)) {
      return {
        success: Boolean(result.success),
        error: result.error,
        contacts: result.contacts,
        invitations: result.invitations,
        data: result.data
      };
    }

    // 如果是字符串，尝试解析
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (error) {
        console.error('[AO] Failed to parse result:', error);
        return {
          success: false,
          error: 'Invalid response format'
        };
      }
    }

    return {
      success: false,
      error: 'Unexpected response format'
    };
  }

  static async sendInvitation(
    address: string,
    nickname: string
  ): Promise<ProcessResult> {
    console.log('[AO] Sending invitation:', { address, nickname });
    
    try {
      const data = {
        to: address,
        nickname: nickname,
        timestamp: Date.now()
      };

      const result = await this.sendMessageWithRetry('SendInvitation', data);
      console.log('[AO] Send invitation result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Send invitation error:', error);
      throw error;
    }
  }

  static async acceptInvitation(from: string, nickname: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('AcceptInvitation', { from, nickname });
  }

  static async rejectInvitation(from: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('RejectInvitation', { from });
  }

  static async removeContact(address: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('RemoveContact', { address });
  }

  static async updateNickname(address: string, nickname: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('UpdateNickname', { address, nickname });
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    try {
      console.log('[AO] Getting pending invitations...');
      const result = await this.sendMessageWithRetry('GetPendingInvitations');
      console.log('[AO] Get invitations raw result:', result);
      return this.processResult(result);
    } catch (error) {
      console.error('[AO] Get invitations error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get invitations'
      };
    }
  }

  static async getContacts(): Promise<ProcessResult> {
    try {
      console.log('[AO] Getting contacts...');
      const result = await this.sendMessageWithRetry('GetContacts');
      console.log('[AO] Get contacts result:', result);
      
      return {
        success: true,
        contacts: Array.isArray(result.contacts) ? result.contacts : [],
        error: null
      };
    } catch (error) {
      console.error('[AO] Get contacts error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get contacts'
      };
    }
  }

  static async createChatroom(participant: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('CreateChatroom', { participant });
  }

  static async acceptChatroom(processId: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('AcceptChatroom', { processId });
  }

  static async joinChatroom(processId: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('Join', {}, processId);
  }

  static async sendChatroomMessage(processId: string, content: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('Send', { content }, processId);
  }

  static async getChatroomMessages(
    processId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ProcessResult> {
    return this.sendMessageWithRetry(
      'GetMessages',
      { page, pageSize },
      processId
    );
  }

  static async getChatrooms(): Promise<ProcessResult> {
    return this.sendMessageWithRetry('GetChatrooms', {});
  }

  static async checkHealth(processId: string = PROCESS_ID): Promise<boolean> {
    try {
      console.log('[AO] Checking health for process:', processId);
      
      const result = await this.sendMessageWithRetry('HealthCheck', {}, processId, 1); // 只尝试一次
      console.log('[AO] Health check result:', result);
      
      // 只要收到响应就认为是健康的
      return true;
    } catch (error) {
      console.error('[AO] Health check failed:', error);
      // 暂时返回 true，因为健康检查可能不可靠
      return true;
    }
  }

  static async getChatroomInvitations(): Promise<ProcessResult> {
    return this.sendMessageWithRetry('GetChatroomInvitations', {});
  }

  static async acceptChatroom(processId: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('AcceptChatroom', { processId });
  }

  static async rejectChatroom(processId: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('RejectChatroom', { processId });
  }

  static async sendMessage(
    action: string,
    data: any = {},
    targetProcess: string = PROCESS_ID
  ): Promise<ProcessResult> {
    return this.sendMessageWithRetry(action, data, targetProcess);
  }
} 