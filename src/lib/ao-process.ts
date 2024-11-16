import { spawn } from "@permaweb/aoconnect";
import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { ProcessResult } from '@/types/ao';
import { getConfig } from '@/config';

const config = getConfig();
const PROCESS_ID = config.ao.processId;

// 保留这些常量，但现在spawn功能已废弃
const CHATROOM_MODULE_TXID = "YOUR_MODULE_TX_ID";
const SCHEDULER_ADDRESS = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA";
const MU_ADDRESS = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY";

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

        // 处理AO的标准输出格式
        if (result && typeof result === 'object') {
          // 检查是否有Output对象
          if ('Output' in result) {
            // 如果Output是字符串，直接尝试解析
            if (typeof result.Output === 'string') {
              try {
                return JSON.parse(result.Output);
              } catch (error) {
                console.error('[AO] Failed to parse Output string:', error);
              }
            }
            // 如果Output是对象且有data字段
            else if (result.Output && typeof result.Output === 'object') {
              if ('data' in result.Output) {
                try {
                  // 如果data是字符串，尝试解析
                  if (typeof result.Output.data === 'string') {
                    const parsedData = JSON.parse(result.Output.data);
                    console.log('[AO] Parsed Output.data:', parsedData);
                    return parsedData;
                  }
                  // 如果data已经是对象，直接返回
                  else if (typeof result.Output.data === 'object') {
                    return result.Output.data;
                  }
                } catch (error) {
                  console.error('[AO] Failed to parse Output.data:', error);
                }
              }
              // 如果Output对象本身有所需的字段，直接返回
              if ('success' in result.Output) {
                return result.Output;
              }
            }
          }
          // 如果结果本身有所需的字段，直接返回
          if ('success' in result) {
            return result;
          }
        }

        // 如果无法解析为标准格式，返回原始数据
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

  // 联系人相关方法
  static async sendInvitation(
    address: string,
    nickname: string
  ): Promise<ProcessResult> {
    try {
      // 获取当前用户地址
      const from = await window.arweaveWallet.getActiveAddress();
      
      console.log('[AO] Sending invitation:', { 
        to: address, 
        from,
        fromNickname: nickname 
      });
      
      const data = {
        to: address,
        from: from,              // 添加发送者地址
        fromNickname: nickname,  // 修改字段名
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
    from: string,
    nickname: string
  ): Promise<ProcessResult> {
    try {
      const data = {
        from,
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

  // 消息相关方法
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

  // 获取联系人和邀请
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
} 