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
    const cacheKey = `${action}-${JSON.stringify(data)}-${targetProcess}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        console.log(`Sending message to process ${targetProcess}:`, {
          action,
          data
        });

        const message = {
          process: targetProcess,
          tags: [{ name: 'Action', value: action }],
          data: JSON.stringify(data),
        };

        const signer = createDataItemSigner(window.arweaveWallet);
        const result = await client.message({
          ...message,
          signer,
        });

        console.log('Raw result:', result);

        let processedResult: ProcessResult;
        if (typeof result === 'string') {
          try {
            processedResult = JSON.parse(result);
          } catch {
            processedResult = {
              success: true,
              data: result
            };
          }
        } else {
          processedResult = result as ProcessResult;
        }

        console.log('Processed result:', processedResult);

        this.cache.set(cacheKey, {
          data: processedResult,
          timestamp: Date.now()
        });

        return processedResult;
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    
    throw lastError;
  }

  static async sendInvitation(to: string, nickname: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('SendInvitation', { to, nickname });
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
    return this.sendMessageWithRetry('GetPendingInvitations', {});
  }

  static async getContacts(): Promise<ProcessResult> {
    return this.sendMessageWithRetry('GetContacts', {});
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
    const cacheKey = `health-check-${processId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      console.log('Checking AO Process health for process:', processId);
      const result = await this.sendMessageWithRetry('health-check', {}, processId);
      const isHealthy = Boolean(result?.success);
      
      this.cache.set(cacheKey, {
        data: isHealthy,
        timestamp: Date.now()
      });

      return isHealthy;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
} 