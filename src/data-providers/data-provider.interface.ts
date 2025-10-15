import { Network, ProtocolParameters, UtxoOutput, UtxoReference } from "../common";


export interface DataProviderConfig {
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface DataProvider {
  /**
   * Get information about specific UTXOs by their references
   */
  getUtxoInfo(utxoRefs: UtxoReference[], network: Network): Promise<UtxoOutput[]>;

  /**
   * Get current protocol parameters
   */
  getProtocolParameters(network: Network): Promise<ProtocolParameters>;

  /**
   * Get provider name
   */
  getProviderName(): string;
}
