import {
  DataProvider,
  DataProviderConfig,
} from './data-provider.interface';
import {
  KoiosUtxoRefRequest,
  KoiosUtxoInfo,
  KoiosCliProtocolParams,
  KoiosError,
  KoiosQueryParams,
  KoiosTxCborResponse
} from './koios-types';
import { Network, ProtocolParameters, UtxoOutput, UtxoReference } from '../common';
import { get_ref_script_bytes} from "de-uplc"

export const KOIOS_ENDPOINTS = {
    mainnet: 'https://api.koios.rest',
    preview: 'https://preview.koios.rest',
    preprod: 'https://preprod.koios.rest',
    guild: 'https://guild.koios.rest'
  } as const;

/**
 * Client for working with Koios API
 * Implements DataProvider interface for abstraction
 */
export class KoiosClient implements DataProvider {
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;

  constructor(config: DataProviderConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000; // 30 seconds by default
    this.retryAttempts = config.retryAttempts || 3;
  }

  getProviderName(): string {
    return 'Koios';
  }

  /**
   * Get information about specific UTXOs by their references
   */
  async getUtxoInfo(utxoRefs: UtxoReference[], network: Network): Promise<UtxoOutput[]> {
    const request: KoiosUtxoRefRequest = {
      _utxo_refs: utxoRefs.map(ref =>`${ref.txHash}#${ref.outputIndex}`),
      _extended: true
    };

    const response = await this.makeRequest<KoiosUtxoInfo[]>('POST', network, '/utxo_info', request);
    return Promise.all(response.map(utxo => this.mapKoiosUtxoToOutput(utxo, network)));
  }

  /**
   * Get current protocol parameters
   */
  async getProtocolParameters(network: Network): Promise<ProtocolParameters> {
    // Use CLI endpoint to get the most up-to-date parameters
    const response = await this.makeRequest<KoiosCliProtocolParams>('GET', network, '/cli_protocol_params');
    
    // Map raw CLI data to standardized format
    return this.mapCliProtocolParams(response);
  }

  async getTxCbor(tx_hash: string, network: Network): Promise<string> {
    const body = {
      _tx_hashes: [tx_hash]
    };
    const response = await this.makeRequest<KoiosTxCborResponse[]>('POST', network, `/tx_cbor`, body);
    if (response.length === 0) {
      throw new Error(`No response for tx_hash ${tx_hash}`);
    }
    return response[0].cbor;
  }


  /**
   * Universal method for making HTTP requests to Koios API
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    network: Network,
    endpoint: string,
    body?: any,
    queryParams?: KoiosQueryParams
  ): Promise<T> {
    const url = new URL(`${KOIOS_ENDPOINTS[network]}/api/v1${endpoint}`);
    
    // Add query parameters if they exist
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout)
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError: Error | undefined;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url.toString(), requestOptions);
        
        if (!response.ok) {
          console.error(`HTTP error ${response.status} for ${method} ${url}`);
          console.error(`Response: ${JSON.stringify(response)}`);
          const errorText = await response.text();
          let koiosError: KoiosError;
          
          try {
            koiosError = JSON.parse(errorText);
          } catch {
            koiosError = { error: `HTTP ${response.status}: ${response.statusText}` };
          }
          
          throw new Error(`Koios API Error: ${koiosError.error}${koiosError.hint ? ' (' + koiosError.hint + ')' : ''}`);
        }

        const data = await response.json();
        return data;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed: ${lastError.message}`);
        
        // If this is the last attempt or a critical error, throw an exception
        if (attempt === this.retryAttempts || error instanceof TypeError) {
          break;
        }
        
        // Wait before the next attempt
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (lastError) {
      throw lastError;
    } else {
      throw new Error('Unknown error');
    }
  }

  /**
   * Map script type from Koios format to internal format
   */
  private mapScriptType(koiosType: string): 'PlutusV1' | 'PlutusV2' | 'PlutusV3' | 'NativeScript' {
    const scriptTypeMap: Record<string, 'PlutusV1' | 'PlutusV2' | 'PlutusV3' | 'NativeScript'> = {
      'native': 'NativeScript',
      'timelock': 'NativeScript',
      'multisig': 'NativeScript',
      'plutusv1': 'PlutusV1',
      'plutusv2': 'PlutusV2',
      'plutusv3': 'PlutusV3'
    };

    const mappedType = scriptTypeMap[koiosType.toLowerCase()];
    
    if (!mappedType) {
      console.warn(`Unknown script type from Koios: ${koiosType}. Defaulting to PlutusV3.`);
      return 'PlutusV3';
    }
    
    return mappedType;
  }

  /**
   * Map UTXO from Koios format to common format
   */
  private async mapKoiosUtxoToOutput(koiosUtxo: KoiosUtxoInfo, network: Network): Promise<UtxoOutput> {
    const assets: Record<string, string> = {};
    
    if (koiosUtxo.asset_list && Array.isArray(koiosUtxo.asset_list)) {
      koiosUtxo.asset_list.forEach(asset => {
        if (!asset.policy_id) {
          console.warn(`Invalid asset in UTXO ${koiosUtxo.tx_hash}#${koiosUtxo.tx_index}: missing policy_id`);
          return;
        }
        
        const assetId = `${asset.policy_id}.${asset.asset_name}`;
        assets[assetId] = asset.quantity || '0';
      });
    }

    let referenceScript;
    if (koiosUtxo.reference_script) {
      // Validate script bytes
      if (!koiosUtxo.reference_script.bytes) {
        console.warn(`Reference script for UTXO ${koiosUtxo.tx_hash}#${koiosUtxo.tx_index} has no bytes`);
        koiosUtxo.reference_script.bytes = await this.extractRefScriptBytes(
          koiosUtxo.tx_hash,
          koiosUtxo.tx_index, 
          network
        );
      }
      
      referenceScript = {
        type: this.mapScriptType(koiosUtxo.reference_script.type),
        script: koiosUtxo.reference_script.bytes || ''
      };
    }

    return {
      txHash: koiosUtxo.tx_hash,
      outputIndex: koiosUtxo.tx_index,
      address: koiosUtxo.address,
      value: {
        lovelace: koiosUtxo.value,
        assets: Object.keys(assets).length > 0 ? assets : undefined
      },
      datumHash: koiosUtxo.datum_hash,
      inlineDatum: koiosUtxo.inline_datum?.bytes,
      referenceScript
    };
  }

  private mapCliProtocolParams(cliParams: KoiosCliProtocolParams): ProtocolParameters {
    // Convert cost models from Record<string, number> to number[]
    let costModels;
    if (cliParams.costModels) {
      costModels = {
        PlutusV1: cliParams.costModels.PlutusV1 ? Object.values(cliParams.costModels.PlutusV1) as number[] : undefined,
        PlutusV2: cliParams.costModels.PlutusV2 ? Object.values(cliParams.costModels.PlutusV2) as number[] : undefined,
        PlutusV3: cliParams.costModels.PlutusV3 ? Object.values(cliParams.costModels.PlutusV3) as number[] : undefined,
      };
    }

    return {
      // Basic fee parameters
      minFeeA: cliParams.minFeeA || cliParams.txFeeFixed || cliParams.min_fee_a || 0,
      minFeeB: cliParams.minFeeB || cliParams.txFeePerByte || cliParams.min_fee_b || 0,
      
      // Size limits
      maxTxSize: cliParams.maxTxSize || cliParams.max_tx_size || 0,
      maxBlockSize: cliParams.maxBlockSize || cliParams.max_block_size,
      maxBhSize: cliParams.maxBhSize || cliParams.max_bh_size,
      maxValSize: cliParams.maxValueSize?.toString() || cliParams.max_val_size,
      
      // Economic parameters
      keyDeposit: (cliParams.stakeAddressDeposit || cliParams.key_deposit || 0).toString(),
      poolDeposit: (cliParams.stakePoolDeposit || cliParams.pool_deposit || 0).toString(),
      minPoolCost: (cliParams.minPoolCost || cliParams.min_pool_cost || 0).toString(),
      minUtxoValue: (cliParams.minUtxoValue || cliParams.min_utxo_value)?.toString(),
      utxoCostPerWord: cliParams.utxoCostPerWord || cliParams.coinsPerUtxoWord || cliParams.coins_per_utxo_size || 0,
      coinsPerUtxoSize: (cliParams.coinsPerUtxoSize || cliParams.coins_per_utxo_size)?.toString(),
      
      // Execution limits
      maxTxExMem: (cliParams.maxTxExecutionUnits?.memory || cliParams.max_tx_ex_mem)?.toString(),
      maxTxExSteps: (cliParams.maxTxExecutionUnits?.steps || cliParams.max_tx_ex_steps)?.toString(),
      maxBlockExMem: (cliParams.maxBlockExecutionUnits?.memory || cliParams.max_block_ex_mem)?.toString(),
      maxBlockExSteps: (cliParams.maxBlockExecutionUnits?.steps || cliParams.max_block_ex_steps)?.toString(),
      maxCollateralInputs: cliParams.maxCollateralInputs || cliParams.max_collateral_inputs,
      collateralPercent: cliParams.collateralPercent || cliParams.collateral_percent,
      
      // Plutus cost models and pricing
      costModels,
      priceMem: cliParams.priceMem || cliParams.price_mem,
      priceStep: cliParams.priceStep || cliParams.price_step,
      
      // Protocol version
      protocolVersion: {
        major: cliParams.protocolVersion?.major || cliParams.protocol_major || 0,
        minor: cliParams.protocolVersion?.minor || cliParams.protocol_minor || 0
      },
      
      // Epoch and governance parameters
      epochNo: cliParams.epochNo || cliParams.epoch_no,
      maxEpoch: cliParams.maxEpoch || cliParams.max_epoch,
      optimalPoolCount: cliParams.optimalPoolCount || cliParams.optimal_pool_count,
      influence: cliParams.influence,
      monetaryExpandRate: cliParams.monetaryExpandRate || cliParams.monetary_expand_rate,
      treasuryGrowthRate: cliParams.treasuryGrowthRate || cliParams.treasury_growth_rate,
      decentralisation: cliParams.decentralisation,
      
      // Additional metadata
      extraEntropy: cliParams.extraEntropy || cliParams.extra_entropy,
      nonce: cliParams.nonce,
      blockHash: cliParams.blockHash || cliParams.block_hash,
    };
  }

  private async extractRefScriptBytes(tx_hash: string, output_index: number, network: Network): Promise<string> {
    const txCbor = await this.getTxCbor(tx_hash, network);
    const refScriptBytes = get_ref_script_bytes(txCbor, output_index);
    return refScriptBytes;
  }
} 