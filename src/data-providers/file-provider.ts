import * as fs from 'fs';
import * as path from 'path';
import {
  DataProvider,
} from './data-provider.interface';
import { Network, ProtocolParameters, UtxoOutput, UtxoReference } from '../common';

export interface FileProviderConfig {
  filePath: string;
  enabled: boolean;
}

export interface DataFile {
  utxos: UtxoOutput[];
  protocolParams: ProtocolParameters;
}

/**
 * File-based data provider that reads UTXOs and protocol parameters from a single JSON file
 * Useful for testing, offline work, or working with cached data
 */
export class FileProvider implements DataProvider {
  private readonly filePath: string;
  private readonly enabled: boolean;

  constructor(config: FileProviderConfig) {
    this.filePath = config.filePath;
    this.enabled = config.enabled;
  }

  /**
   * Read data file and parse it
   */
  private async readDataFile(): Promise<DataFile> {
    const fullPath = path.resolve(this.filePath);
    
    try {
      const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
      const data: DataFile = JSON.parse(fileContent);
      
      // Validate that required fields exist
      if (!data.utxos || !Array.isArray(data.utxos)) {
        throw new Error('Invalid data file: missing or invalid utxos array');
      }
      if (!data.protocolParams || typeof data.protocolParams !== 'object') {
        throw new Error('Invalid data file: missing or invalid protocolParameters object');
      }
      
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Data file not found: ${fullPath}`);
      }
      throw new Error(`Failed to read data file: ${(error as Error).message}`);
    }
  }

  /**
   * Get information about specific UTXOs by their references
   * Reads from data file and filters by provided references
   */
  async getUtxoInfo(utxoRefs: UtxoReference[], network: Network): Promise<UtxoOutput[]> {
    if (!this.enabled) {
       throw new Error('FileProvider is disabled');
    }

    const data = await this.readDataFile();

    // Filter UTXOs by provided references
    const filteredUtxos = data.utxos.filter(utxo => 
      utxoRefs.some(ref => 
        ref.txHash === utxo.txHash && ref.outputIndex === utxo.outputIndex
      )
    );

    return filteredUtxos;
  }

  /**
   * Get current protocol parameters
   * Reads from data file
   */
  async getProtocolParameters(): Promise<ProtocolParameters> {
    if (!this.enabled) {
      throw new Error('FileProvider is disabled');
    }
    const data = await this.readDataFile();
    return data.protocolParams;
  }

  /**
   * Get all UTXOs from file (utility method)
   */
  async getAllUtxos(): Promise<UtxoOutput[]> {
    if (!this.enabled) {
       throw new Error('FileProvider is disabled');
    }

    const data = await this.readDataFile();
    return data.utxos;
  }

  /**
   * Save complete data to file (utility method)
   */
  async saveData(utxos: UtxoOutput[], protocolParams: ProtocolParameters): Promise<void> {
    const fullPath = path.resolve(this.filePath);
    
    try {
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      
      const data: DataFile = {
        utxos,
        protocolParams
      };
      
      const fileContent = JSON.stringify(data, null, 2);
      await fs.promises.writeFile(fullPath, fileContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save data file: ${(error as Error).message}`);
    }
  }

  /**
   * Update UTXOs only (preserving protocol parameters)
   */
  async updateUtxos(utxos: UtxoOutput[]): Promise<void> {
    const data = await this.readDataFile();
    await this.saveData(utxos, data.protocolParams);
  }

  /**
   * Update protocol parameters only (preserving UTXOs)
   */
  async updateProtocolParameters(protocolParameters: ProtocolParameters): Promise<void> {
    const data = await this.readDataFile();
    await this.saveData(data.utxos, protocolParameters);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'File Provider';
  }

  /**
   * Get file configuration info
   */
  getConfig(): { filePath: string } {
    return {
      filePath: this.filePath,
    };
  }
} 