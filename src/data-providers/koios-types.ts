export interface KoiosUtxoRefRequest {
  _utxo_refs: Array<string>;
  _extended?: boolean;
  _scripts?: boolean;
  _assets?: boolean;
  _bytecode?: boolean;
}

export interface KoiosTxCborResponse {
  tx_hash: string;
  block_hash: string;
  block_height: number;
  epoch_no: number;
  absolute_slot: number;
  tx_timestamp: number;
  cbor: string;
}

export interface KoiosUtxoInfo {
  tx_hash: string;
  address: string;
  tx_index: number;
  value: string;
  asset_list?: Array<{
    policy_id: string;
    asset_name: string;
    fingerprint: string;
    decimals?: number;
    quantity: string;
  }>;
  datum_hash?: string;
  inline_datum?: {
    bytes: string;
    value: any;
  };
  reference_script?: {
    hash: string;
    size: number;
    type: 'plutusV1' | 'plutusV2' | 'plutusV3' | 'native' | 'timelock' | 'multisig';
    bytes?: string;
    value?: any;
  };
  block_height?: number;
  block_time?: number;
}

export interface KoiosProtocolParams {
  epoch_no: number;
  min_fee_a: number;
  min_fee_b: number;
  max_block_size: number;
  max_tx_size: number;
  max_bh_size: number;
  key_deposit: string;
  pool_deposit: string;
  max_epoch: number;
  optimal_pool_count: number;
  influence: number;
  monetary_expand_rate: number;
  treasury_growth_rate: number;
  decentralisation: number;
  extra_entropy: string | null;
  protocol_major: number;
  protocol_minor: number;
  min_utxo_value: string;
  min_pool_cost: string;
  nonce: string;
  block_hash: string;
  cost_models?: {
    PlutusV1?: Record<string, number>;
    PlutusV2?: Record<string, number>;
    PlutusV3?: Record<string, number>;
  };
  price_mem?: number;
  price_step?: number;
  max_tx_ex_mem?: string;
  max_tx_ex_steps?: string;
  max_block_ex_mem?: string;
  max_block_ex_steps?: string;
  max_val_size?: string;
  collateral_percent?: number;
  max_collateral_inputs?: number;
  coins_per_utxo_size?: string;
}

export interface KoiosCliProtocolParams {
  [key: string]: any;
}

export interface KoiosError {
  error: string;
  hint?: string;
}

export interface KoiosApiResponse<T> {
  data?: T;
  error?: KoiosError;
}

export interface KoiosRequestConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface KoiosQueryParams {
  select?: string;
  limit?: number;
  offset?: number;
  order?: string;
  [filter: string]: any;
}

export interface KoiosTip {
  hash: string;
  epoch_no: number;
  abs_slot: number;
  epoch_slot: number;
  block_height: number;
  block_time: number;
} 