const Arweave = require('arweave');
const fs = require('fs');
const path = require('path');

const deployModule = async () => {
    try {
        // 初始化 Arweave，添加超时设置
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https',
            timeout: 60000, // 60秒超时
            logging: true   // 启用日志
        });

        // 读取钱包文件
        const walletPath = path.join(process.cwd(), 'wallet.json');
        console.log('Looking for wallet at:', walletPath);
        
        if (!fs.existsSync(walletPath)) {
            throw new Error(`Wallet file not found at ${walletPath}`);
        }

        const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));

        // 添加重试机制的辅助函数
        const retry = async (fn, retries = 3, delay = 2000) => {
            try {
                return await fn();
            } catch (error) {
                if (retries === 0) throw error;
                console.log(`Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return retry(fn, retries - 1, delay * 2);
            }
        };

        // 读取聊天室模板代码
        const templateSrc = `
            if not State then
                State = {
                    info = {
                        created_at = os.time(),
                        creator = ao.id
                    },
                    messages = {},
                    participants = {}
                }
            end

            -- 验证发送者权限
            function isParticipant(address)
                return State.participants[address]
            end

            -- 加入聊天室
            Handlers.add(
                "Join",
                Handlers.utils.hasMatchingTag("Action", "Join"),
                function(msg)
                    local address = msg.From
                    State.participants[address] = true
                    return ao.json.encode({ success = true })
                end
            )

            -- 发送消息
            Handlers.add(
                "Send",
                Handlers.utils.hasMatchingTag("Action", "Send"),
                function(msg)
                    if not isParticipant(msg.From) then
                        return ao.json.encode({ success = false, error = "Not a participant" })
                    end

                    local message = {
                        sender = msg.From,
                        content = msg.Data.content,
                        timestamp = os.time()
                    }
                    
                    table.insert(State.messages, message)
                    return ao.json.encode({ success = true, message = message })
                end
            )

            -- 获取消息历史
            Handlers.add(
                "GetMessages",
                Handlers.utils.hasMatchingTag("Action", "GetMessages"),
                function(msg)
                    if not isParticipant(msg.From) then
                        return ao.json.encode({ success = false, error = "Not a participant" })
                    end
                    
                    return ao.json.encode({ 
                        success = true, 
                        messages = State.messages
                    })
                end
            )
        `;

        console.log('Creating transaction...');
        
        // 使用重试机制创建交易
        const tx = await retry(async () => {
            const transaction = await arweave.createTransaction({
                data: templateSrc
            }, wallet);

            // 添加标签
            transaction.addTag('Content-Type', 'application/x-lua');
            transaction.addTag('App-Name', 'AO-Chat');
            transaction.addTag('Type', 'Module');
            transaction.addTag('Data-Protocol', 'ao');

            return transaction;
        });

        console.log('Signing transaction...');
        
        // 签名交易
        await retry(async () => {
            await arweave.transactions.sign(tx, wallet);
        });
        
        console.log('Transaction signed:', tx.id);

        // 获取上传价格
        const price = await retry(async () => {
            return await arweave.transactions.getPrice(
                Buffer.from(templateSrc).length
            );
        });
        
        console.log('Upload price:', arweave.ar.winstonToAr(price), 'AR');

        // 上传交易
        console.log('Posting transaction...');
        const response = await retry(async () => {
            return await arweave.transactions.post(tx);
        });
        
        if (response.status === 200 || response.status === 202) {
            console.log('Module deployed successfully!');
            console.log('Transaction ID:', tx.id);
            console.log('Please update CHATROOM_MODULE_TXID in your code with this ID');
            return tx.id;
        } else {
            throw new Error(`Failed to deploy: ${response.status} ${response.statusText}`);
        }

    } catch (error) {
        console.error('Deployment failed:', error);
        throw error;
    }
};

// 运行部署
deployModule()
    .then((txId) => {
        console.log('Deployment completed successfully');
    })
    .catch((error) => {
        console.error('Deployment failed:', error);
        process.exit(1);
    });
