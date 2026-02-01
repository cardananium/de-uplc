export interface Breakpoint {
    id: number;
    line: number;
    active: boolean;
}

export interface Budget {
    exUnitsSpent: number;
    exUnitsAvailable: number;
    memoryUnitsSpent: number;
    memoryUnitsAvailable: number;
}

export interface UtxoReference {
    txHash: string;
    outputIndex: number;
}

export type SessionState = "stopped" | "running" | "pause" | "empty";

export type Network = 'mainnet' | 'preview' | 'preprod';

export interface DebuggerContext {
    utxos: UtxoOutput[] | undefined;
    protocolParams: ProtocolParameters | undefined;
    network: Network | undefined;
    customEndpoint?: string;
    transaction: string;
  }
  
  export interface UtxoOutput {
    txHash: string;
    outputIndex: number;
    address: string;
    value: {
      lovelace: string;
      assets?: Record<string, string>; // policyId.assetName -> amount
    };
    datumHash?: string;
    inlineDatum?: string;
    referenceScript?: {
      type: 'PlutusV1' | 'PlutusV2' | 'PlutusV3' | 'NativeScript';
      script: string;
    };
  }
  
  export interface ProtocolParameters {
    // Basic fee parameters
    minFeeA: number;
    minFeeB: number;
    
    // Size limits
    maxTxSize: number;
    maxBlockSize?: number;
    maxBhSize?: number;
    maxValSize?: number;
    
    // Economic parameters
    keyDeposit: string;
    poolDeposit: string;
    minPoolCost: string;
    minUtxoValue?: string;
    utxoCostPerWord: number;
    coinsPerUtxoSize?: string;
    
    // Execution limits
    maxTxExMem?: string;
    maxTxExSteps?: string;
    maxBlockExMem?: string;
    maxBlockExSteps?: string;
    maxCollateralInputs?: number;
    collateralPercent?: number;
    
    // Plutus cost models
    costModels?: {
      PlutusV1?: number[];
      PlutusV2?: number[];
      PlutusV3?: number[];
    };
    priceMem?: number;
    priceStep?: number;
    
    // Protocol version
    protocolVersion: {
      major: number;
      minor: number;
    };
    
    // Epoch and governance parameters
    epochNo?: number;
    maxEpoch?: number;
    optimalPoolCount?: number;
    influence?: number;
    monetaryExpandRate?: number;
    treasuryGrowthRate?: number;
    decentralisation?: number;
    
    // Additional metadata
    extraEntropy?: string | null;
    nonce?: string;
    blockHash?: string;
}
