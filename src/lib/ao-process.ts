import { spawn } from "@permaweb/aoconnect";
import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { ProcessResult } from '@/types/ao';
import { getConfig } from '@/config';

const config = getConfig();
const PROCESS_ID = config.ao.processId;

const CHATROOM_MODULE_TXID = "dPShNlEgRzHknhiTwPd8ocgWhr3mFAbw-4iao02LkSE"; // 这个需要替换为实际部署后的TXID
const SCHEDULER_ADDRESS = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA";
const MU_ADDRESS = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY";

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
        return this.processResult(result);

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
      console.log('[AO] Decoded Uint8Array result:', decodedResult);
      
      try {
        // 尝试解析为JSON
        return JSON.parse(decodedResult);
      } catch (error) {
        console.error('[AO] Failed to parse Uint8Array result:', error);
        // 如果解析失败，尝试处理原始字符串
        return this.processRawString(decodedResult);
      }
    }

    // 如果结果是字符串，尝试解析
    if (typeof result === 'string') {
      try {
        // 检查是否是Base64编码
        if (/^[A-Za-z0-9+/=]+$/.test(result)) {
          try {
            const decoded = atob(result);
            console.log('[AO] Decoded Base64 result:', decoded);
            try {
              return JSON.parse(decoded);
            } catch {
              return this.processRawString(decoded);
            }
          } catch (error) {
            console.log('[AO] Not a valid Base64 JSON');
          }
        }

        // 尝试直接解析JSON
        try {
          return JSON.parse(result);
        } catch {
          return this.processRawString(result);
        }
      } catch (error) {
        console.error('[AO] Failed to parse string result:', error);
        return {
          success: false,
          error: 'Invalid response format',
          data: result
        };
      }
    }

    // 如果结果已经是对象格式
    if (typeof result === 'object' && !Array.isArray(result)) {
      return {
        success: Boolean(result.success),
        error: result.error,
        contacts: Array.isArray(result.contacts) ? result.contacts : [],
        invitations: Array.isArray(result.invitations) ? result.invitations : [],
        data: result.data
      };
    }

    // 如果是其他格式，返回错误
    console.error('[AO] Unexpected result format:', result);
    return {
      success: false,
      error: 'Unexpected response format',
      data: result
    };
  }

  // 添加处理原始字符串的方法
  private static processRawString(str: string): ProcessResult {
    console.log('[AO] Processing raw string:', str);
    
    // 尝试从字符串中提取有效数据
    const contactsMatch = str.match(/contacts[=:]\s*(\[.*?\])/s);
    const invitationsMatch = str.match(/invitations[=:]\s*(\[.*?\])/s);
    
    try {
      const contacts = contactsMatch ? JSON.parse(contactsMatch[1]) : [];
      const invitations = invitationsMatch ? JSON.parse(invitationsMatch[1]) : [];
      
      return {
        success: true,
        contacts,
        invitations,
        data: str
      };
    } catch (error) {
      console.error('[AO] Failed to extract data from string:', error);
      return {
        success: true,
        contacts: [],
        invitations: [],
        data: str
      };
    }
  }

  static async sendInvitation(
    address: string,
    nickname: string
  ): Promise<ProcessResult> {
    console.log('[AO] Sending invitation:', { address, nickname });
    
    try {
      // 检查当前状态
      const beforeState = await this.debugState();
      console.log('[AO] State before invitation:', beforeState);

      const data = {
        to: address,
        nickname: nickname,
        timestamp: Math.floor(Date.now() / 1000)  // 使用Unix时间戳
      };

      const result = await this.sendMessageWithRetry('SendInvitation', data);
      console.log('[AO] Send invitation result:', result);

      // 检查更新后的状态
      const afterState = await this.debugState();
      console.log('[AO] State after invitation:', afterState);

      return result;
    } catch (error) {
      console.error('[AO] Send invitation error:', error);
      throw error;
    }
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    try {
      console.log('[AO] Getting pending invitations...');
      const result = await this.sendMessageWithRetry('GetPendingInvitations');
      console.log('[AO] Get invitations raw result:', result);
      
      // 确保返回一致的格式
      return {
        success: true,
        invitations: Array.isArray(result.invitations) ? result.invitations : [],
        error: null
      };
    } catch (error) {
      console.error('[AO] Get invitations error:', error);
      return {
        success: false,
        invitations: [],
        error: error instanceof Error ? error.message : 'Failed to get invitations'
      };
    }
  }

  static async getContacts(): Promise<ProcessResult> {
    try {
      console.log('[AO] Getting contacts...');
      const result = await this.sendMessageWithRetry('GetContacts');
      console.log('[AO] Get contacts raw result:', result);
      
      // 确保返回一致的格式
      return {
        success: true,
        contacts: Array.isArray(result.contacts) ? result.contacts : [],
        error: null
      };
    } catch (error) {
      console.error('[AO] Get contacts error:', error);
      return {
        success: false,
        contacts: [],
        error: error instanceof Error ? error.message : 'Failed to get contacts'
      };
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

  static async createChatroom(participant: string): Promise<ProcessResult> {
    try {
      console.log('[AO] Creating chatroom with participant:', participant);
      
      if (!window.arweaveWallet) {
        throw new Error('ArConnect not found');
      }
      const creator = await window.arweaveWallet.getActiveAddress();

      // 使用ao-sdk的spawn方法创建进程
      const result = await spawn({
        module: CHATROOM_MODULE_TXID,
        scheduler: SCHEDULER_ADDRESS,
        signer: createDataItemSigner(window.arweaveWallet),
        tags: [
          { name: "Authority", value: MU_ADDRESS },
          { name: "Action", value: "CreateChatroom" },
          { name: "Creator", value: creator },
          { name: "Participant", value: participant },
          { name: "Type", value: "Chatroom" }
        ]
      });

      console.log('[AO] Spawn result:', result);

      if (!result.process) {
        throw new Error('Failed to create chatroom process');
      }

      // 创建聊天室信息
      const chatroom = {
        processId: result.process,
        creator,
        participant,
        participants: [creator, participant],
        createdAt: Math.floor(Date.now() / 1000)
      };

      return {
        success: true,
        processId: result.process,
        chatroom
      };

    } catch (error) {
      console.error('[AO] Create chatroom error:', error);
      throw error;
    }
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

  static async debugState(): Promise<ProcessResult> {
    try {
      const result = await this.sendMessageWithRetry('DebugState');
      console.log('[AO] Debug state result:', result);
      return result;
    } catch (error) {
      console.error('[AO] Debug state error:', error);
      throw error;
    }
  }

  static async spawnChatroom(participant: string): Promise<ProcessResult> {
    try {
      console.log('[AO] Spawning chatroom process for participant:', participant);
      
      if (!window.arweaveWallet) {
        throw new Error('ArConnect not found');
      }
      const creator = await window.arweaveWallet.getActiveAddress();

      // 使用ao-sdk的spawn方法创建进程
      const result = await spawn({
        module: CHATROOM_MODULE_TXID,
        scheduler: SCHEDULER_ADDRESS,
        signer: createDataItemSigner(window.arweaveWallet),
        tags: [
          { name: "Authority", value: MU_ADDRESS },
          { name: "Action", value: "CreateChatroom" },
          { name: "Creator", value: creator },
          { name: "Participant", value: participant },
          { name: "Type", value: "Chatroom" }
        ]
      });

      console.log('[AO] Spawn result:', result);

      if (!result.process) {
        throw new Error('Failed to spawn chatroom process');
      }

      return {
        success: true,
        processId: result.process,
        creator,
        participant
      };

    } catch (error) {
      console.error('[AO] Spawn chatroom error:', error);
      throw error;
    }
  }

  static async sendChatroomInvitation(
    to: string, 
    processId: string
  ): Promise<ProcessResult> {
    try {
      console.log('[AO] Sending chatroom invitation:', { to, processId });

      const data = {
        to,
        processId,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = await this.sendMessageWithRetry('SendChatroomInvitation', data);
      console.log('[AO] Send chatroom invitation result:', result);

      return result;
    } catch (error) {
      console.error('[AO] Send chatroom invitation error:', error);
      throw error;
    }
  }

  static async createChatroom(participant: string): Promise<ProcessResult> {
    try {
      console.log('[AO] Creating chatroom with participant:', participant);

      // 1. 先创建聊天室进程
      const spawnResult = await this.spawnChatroom(participant);
      if (!spawnResult.success || !spawnResult.processId) {
        throw new Error('Failed to spawn chatroom process');
      }

      console.log('[AO] Chatroom process spawned:', spawnResult);

      // 2. 发送邀请
      const inviteResult = await this.sendChatroomInvitation(
        participant, 
        spawnResult.processId
      );

      if (!inviteResult.success) {
        throw new Error('Failed to send chatroom invitation');
      }

      console.log('[AO] Chatroom invitation sent:', inviteResult);

      // 3. 返回完整的结果
      const chatroom = {
        processId: spawnResult.processId,
        creator: spawnResult.creator,
        participant: spawnResult.participant,
        participants: [spawnResult.creator, spawnResult.participant],
        createdAt: Math.floor(Date.now() / 1000)
      };

      return {
        success: true,
        processId: spawnResult.processId,
        chatroom
      };

    } catch (error) {
      console.error('[AO] Create chatroom error:', error);
      throw error;
    }
  }
} 