import Arweave from 'arweave';
import { AOProcess } from '@permaweb/ao-sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface DeploymentConfig {
  wallet: string;
  outDir: string;
  processPath: string;
  appName: string;
  version: string;
}

interface FileInfo {
  path: string;
  relativePath: string;
  type: string;
}

class Deployer {
  private arweave: Arweave;
  private wallet: any;
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https'
    });
    this.wallet = JSON.parse(fs.readFileSync(config.wallet, 'utf-8'));
  }

  // 收集所有需要部署的文件
  private async collectFiles(dir: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...await this.collectFiles(fullPath));
      } else {
        files.push({
          path: fullPath,
          relativePath: path.relative(this.config.outDir, fullPath),
          type: this.getContentType(item)
        });
      }
    }

    return files;
  }

  // 获取文件的Content-Type
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  // 部署AO Process
  private async deployProcess(): Promise<string> {
    console.log('Deploying AO Process...');
    
    try {
      const processCode = fs.readFileSync(this.config.processPath, 'utf-8');
      const result = await AOProcess.deploy(processCode);
      console.log('AO Process deployed successfully:', result.processId);
      return result.processId;
    } catch (error) {
      console.error('Failed to deploy AO Process:', error);
      throw error;
    }
  }

  // 部署静态文件到Arweave
  private async deployFiles(files: FileInfo[]): Promise<Map<string, string>> {
    console.log('Deploying files to Arweave...');
    const deployments = new Map<string, string>();

    for (const file of files) {
      try {
        const data = fs.readFileSync(file.path);
        const tx = await this.arweave.createTransaction({ data });
        
        tx.addTag('Content-Type', file.type);
        tx.addTag('App-Name', this.config.appName);
        tx.addTag('App-Version', this.config.version);

        await this.arweave.transactions.sign(tx, this.wallet);
        await this.arweave.transactions.post(tx);

        deployments.set(file.relativePath, tx.id);
        console.log(`Deployed ${file.relativePath}: ${tx.id}`);
      } catch (error) {
        console.error(`Failed to deploy ${file.relativePath}:`, error);
        throw error;
      }
    }

    return deployments;
  }

  // 创建和部署manifest
  private async deployManifest(
    fileMap: Map<string, string>,
    processId: string
  ): Promise<string> {
    console.log('Creating and deploying manifest...');

    const manifest = {
      manifest: 'arweave/paths',
      version: '0.1.0',
      index: {
        path: 'index.html'
      },
      paths: Object.fromEntries(fileMap),
      processId,
      appInfo: {
        name: this.config.appName,
        version: this.config.version,
        timestamp: Date.now()
      }
    };

    const tx = await this.arweave.createTransaction({
      data: JSON.stringify(manifest)
    });

    tx.addTag('Content-Type', 'application/x.arweave-manifest+json');
    tx.addTag('App-Name', this.config.appName);
    tx.addTag('App-Version', this.config.version);

    await this.arweave.transactions.sign(tx, this.wallet);
    await this.arweave.transactions.post(tx);

    return tx.id;
  }

  // 主部署流程
  public async deploy(): Promise<void> {
    try {
      // 1. 构建项目
      console.log('Building project...');
      execSync('npm run build', { stdio: 'inherit' });

      // 2. 部署AO Process
      const processId = await this.deployProcess();

      // 3. 收集静态文件
      const files = await this.collectFiles(this.config.outDir);

      // 4. 部署静态文件
      const fileMap = await this.deployFiles(files);

      // 5. 部署manifest
      const manifestId = await this.deployManifest(fileMap, processId);

      // 6. 输出部署信息
      console.log('\nDeployment completed successfully!');
      console.log('-----------------------------------');
      console.log('Manifest Transaction:', manifestId);
      console.log('AO Process ID:', processId);
      console.log('App URL:', `https://arweave.net/${manifestId}`);
      console.log('-----------------------------------');

    } catch (error) {
      console.error('Deployment failed:', error);
      process.exit(1);
    }
  }
}

// 运行部署
const config: DeploymentConfig = {
  wallet: process.env.WALLET_PATH || 'wallet.json',
  outDir: path.join(process.cwd(), 'out'),
  processPath: path.join(process.cwd(), 'process', 'chat.lua'),
  appName: 'AO-CHAT',
  version: process.env.npm_package_version || '1.0.0'
};

new Deployer(config).deploy().catch(console.error); 