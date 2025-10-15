interface Budget {
  exUnitsAvailable: number;
  exUnitsSpent: number;
  memoryUnitsAvailable: number;
  memoryUnitsSpent: number;
}

type ExecutionStatus =
  | {
      status_type: 'Ready';
    }
  | {
      result: Term;
      status_type: 'Done';
    }
  | {
      message: string;
      status_type: 'Error';
    };

type Constant =
  | {
      type: 'Integer';
      value: string;
    }
  | {
      type: 'ByteString';
      value: string;
    }
  | {
      type: 'String';
      value: string;
    }
  | {
      type: 'Bool';
      value: boolean;
    }
  | {
      type: 'Unit';
    }
  | {
      elementType: Type;
      type: 'ProtoList';
      values: Constant[];
    }
  | {
      first_element: Constant;
      first_type: Type;
      second_element: Constant;
      second_type: Type;
      type: 'ProtoPair';
    }
  | {
      data: PlutusData;
      type: 'Data';
    }
  | {
      serialized: string;
      type: 'Bls12_381G1Element';
    }
  | {
      serialized: string;
      type: 'Bls12_381G2Element';
    }
  | {
      bytes: string;
      type: 'Bls12_381MlResult';
    };

interface KeyValuePair {
  key: PlutusData;
  value: PlutusData;
}

type PlutusData =
  | {
      any_constructor?: number | null;
      fields: PlutusData[];
      tag: number;
      type: 'Constr';
    }
  | {
      key_value_pairs: KeyValuePair[];
      type: 'Map';
    }
  | (
      | {
          Int: string;
        }
      | {
          BigUInt: string;
        }
      | {
          BigNInt: string;
        }
    )
  | {
      type: 'BoundedBytes';
      value: string;
    }
  | {
      type: 'Array';
      values: PlutusData[];
    };

type Term =
  | {
      id: number;
      name: string;
      term_type: 'Var';
    }
  | {
      id: number;
      term: Term;
      term_type: 'Delay';
    }
  | {
      body: Term;
      id: number;
      parameterName: string;
      term_type: 'Lambda';
    }
  | {
      argument: Term;
      function: Term;
      id: number;
      term_type: 'Apply';
    }
  | {
      constant: Constant;
      id: number;
      term_type: 'Constant';
    }
  | {
      id: number;
      term: Term;
      term_type: 'Force';
    }
  | {
      id: number;
      term_type: 'Error';
    }
  | {
      fun: string;
      id: number;
      term_type: 'Builtin';
    }
  | {
      constructorTag: number;
      fields: Term[];
      id: number;
      term_type: 'Constr';
    }
  | {
      branches: Term[];
      constr: Term;
      id: number;
      term_type: 'Case';
    };

type Type =
  | {
      type: 'Bool';
    }
  | {
      type: 'Integer';
    }
  | {
      type: 'String';
    }
  | {
      type: 'ByteString';
    }
  | {
      type: 'Unit';
    }
  | {
      elementType: Type;
      type: 'List';
    }
  | {
      first_type: Type;
      second_type: Type;
      type: 'Pair';
    }
  | {
      type: 'Data';
    }
  | {
      type: 'Bls12_381G1Element';
    }
  | {
      type: 'Bls12_381G2Element';
    }
  | {
      type: 'Bls12_381MlResult';
    };

type MachineContext =
  | {
      context_type: 'FrameAwaitArg';
      value: Value;
    }
  | {
      context_type: 'FrameAwaitFunTerm';
      env: Env;
      term: EitherTermOrId;
    }
  | {
      context_type: 'FrameAwaitFunValue';
      value: Value;
    }
  | {
      context_type: 'FrameForce';
    }
  | {
      context_type: 'FrameConstr';
      env: Env;
      tag: number;
      term_id: number;
      terms: EitherTermOrId[];
      values: Value[];
    }
  | {
      context_type: 'FrameCases';
      env: Env;
      terms: EitherTermOrId[];
    }
  | {
      context_type: 'NoFrame';
    };

type EitherTermOrId =
  | {
      term: Term;
      type: 'Term';
    }
  | {
      id: number;
      type: 'Id';
    };

interface BuiltinRuntime {
  args: Value[];
  arity: number;
  forces: number;
  fun: string;
}

interface Env {
  values: Value[];
}

type Value =
  | {
      constant: Constant;
      value_type: 'Con';
    }
  | {
      body: EitherTermOrId;
      env: Env;
      term_id: number;
      value_type: 'Delay';
    }
  | {
      body: EitherTermOrId;
      env: Env;
      parameterName: string;
      term_id: number;
      value_type: 'Lambda';
    }
  | {
      fun: string;
      runtime: BuiltinRuntime;
      term_id: number;
      value_type: 'Builtin';
    }
  | {
      fields: Value[];
      tag: number;
      term_id: number;
      value_type: 'Constr';
    };

type MachineState =
  | {
      context: MachineContext;
      machine_state_type: 'Return';
      value: Value;
    }
  | {
      context: MachineContext;
      env: Env;
      machine_state_type: 'Compute';
      term: EitherTermOrId;
    }
  | {
      machine_state_type: 'Done';
      term: EitherTermOrId;
    };

type ScriptContext =
  | {
      purpose: ScriptPurpose;
      script_context_version: 'V1V2';
      tx_info: TxInfo;
    }
  | {
      purpose: ScriptInfo;
      redeemer: PlutusData;
      script_context_version: 'V3';
      tx_info: TxInfo;
    };

interface Anchor {
  data_hash: string;
  url: string;
}

interface Asset {
  policy_id: string;
  tokens: Token[];
}

type CardanoValue =
  | {
      amount: number;
      value_type: 'Coin';
    }
  | {
      assets: Asset[];
      coin: number;
      value_type: 'Multiasset';
    };

type Certificate =
  | {
      certificate_type: 'StakeRegistration';
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'StakeDeregistration';
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'StakeDelegation';
      pool_keyhash: string;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'PoolRegistration';
      pool_params: PoolParams;
    }
  | {
      certificate_type: 'PoolRetirement';
      epoch: number;
      pool_keyhash: string;
    }
  | {
      certificate_type: 'Reg';
      deposit: number;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'UnReg';
      refund: number;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'VoteDeleg';
      drep: DRep;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'StakeVoteDeleg';
      drep: DRep;
      pool_keyhash: string;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'StakeRegDeleg';
      deposit: number;
      pool_keyhash: string;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'VoteRegDeleg';
      deposit: number;
      drep: DRep;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'StakeVoteRegDeleg';
      deposit: number;
      drep: DRep;
      pool_keyhash: string;
      stake_credential: StakeCredential;
    }
  | {
      certificate_type: 'AuthCommitteeHot';
      committee_cold_credential: StakeCredential;
      committee_hot_credential: StakeCredential;
    }
  | {
      anchor?: Anchor | null;
      certificate_type: 'ResignCommitteeCold';
      committee_cold_credential: StakeCredential;
    }
  | {
      anchor?: Anchor | null;
      certificate_type: 'RegDRepCert';
      deposit: number;
      drep_credential: StakeCredential;
    }
  | {
      certificate_type: 'UnRegDRepCert';
      drep_credential: StakeCredential;
      refund: number;
    }
  | {
      anchor?: Anchor | null;
      certificate_type: 'UpdateDRepCert';
      drep_credential: StakeCredential;
    };

interface Constitution {
  anchor: Anchor;
  guardrail_script?: string | null;
}

interface CostModels {
  plutus_v1?: number[] | null;
  plutus_v2?: number[] | null;
  plutus_v3?: number[] | null;
}

type DRep =
  | {
      drep_type: 'Key';
      hash: string;
    }
  | {
      drep_type: 'Script';
      hash: string;
    }
  | {
      drep_type: 'Abstain';
    }
  | {
      drep_type: 'NoConfidence';
    };

interface DRepVotingThresholds {
  committee_no_confidence: Rational;
  committee_normal: Rational;
  hard_fork_initiation: Rational;
  motion_no_confidence: Rational;
  pp_economic_group: Rational;
  pp_governance_group: Rational;
  pp_network_group: Rational;
  pp_technical_group: Rational;
  treasury_withdrawal: Rational;
  update_constitution: Rational;
}

type DatumOption =
  | {
      datum_type: 'Hash';
      hash: string;
    }
  | {
      data: PlutusData;
      datum_type: 'Data';
    };

interface ExUnitPrices {
  mem_price: Rational;
  step_price: Rational;
}

interface ExUnits {
  mem: number;
  steps: number;
}

type GovAction =
  | {
      action_type: 'ParameterChange';
      gov_action_id?: GovActionId | null;
      policy_hash?: string | null;
      protocol_params_update: ProtocolParamsUpdate;
    }
  | {
      action_type: 'HardForkInitiation';
      gov_action_id?: GovActionId | null;
      protocol_version: ProtocolVersion;
    }
  | {
      action_type: 'TreasuryWithdrawals';
      policy_hash?: string | null;
      withdrawals: {
        [k: string]: number;
      };
    }
  | {
      action_type: 'NoConfidence';
      gov_action_id?: GovActionId | null;
    }
  | {
      action_type: 'UpdateCommittee';
      gov_action_id?: GovActionId | null;
      members_to_add: {
        [k: string]: number;
      };
      members_to_remove: StakeCredential[];
      quorum_threshold: Rational;
    }
  | {
      action_type: 'NewConstitution';
      constitution: Constitution;
      gov_action_id?: GovActionId | null;
    }
  | {
      action_type: 'Information';
    };

interface GovActionId {
  action_index: number;
  transaction_id: string;
}

interface MintValue {
  mint_value: Asset[];
}

interface PoolMetadata {
  hash: string;
  url: string;
}

interface PoolParams {
  cost: number;
  margin: Rational;
  operator: string;
  pledge: number;
  pool_metadata?: PoolMetadata | null;
  pool_owners: string[];
  relays: Relay[];
  reward_account: string;
  vrf_keyhash: string;
}

interface PoolVotingThresholds {
  committee_no_confidence: Rational;
  committee_normal: Rational;
  hard_fork_initiation: Rational;
  motion_no_confidence: Rational;
  security_voting_threshold: Rational;
}

interface ProposalProcedure {
  anchor: Anchor;
  deposit: number;
  gov_action: GovAction;
  reward_account: string;
}

interface ProtocolParamsUpdate {
  ada_per_utxo_byte?: number | null;
  collateral_percentage?: number | null;
  committee_term_limit?: number | null;
  cost_models_for_script_languages?: CostModels | null;
  desired_number_of_stake_pools?: number | null;
  drep_deposit?: number | null;
  drep_inactivity_period?: number | null;
  drep_voting_thresholds?: DRepVotingThresholds | null;
  execution_costs?: ExUnitPrices | null;
  expansion_rate?: Rational | null;
  governance_action_deposit?: number | null;
  governance_action_validity_period?: number | null;
  key_deposit?: number | null;
  max_block_body_size?: number | null;
  max_block_ex_units?: ExUnits | null;
  max_block_header_size?: number | null;
  max_collateral_inputs?: number | null;
  max_transaction_size?: number | null;
  max_tx_ex_units?: ExUnits | null;
  max_value_size?: number | null;
  maximum_epoch?: number | null;
  min_committee_size?: number | null;
  min_pool_cost?: number | null;
  minfee_a?: number | null;
  minfee_b?: number | null;
  minfee_refscript_cost_per_byte?: Rational | null;
  pool_deposit?: number | null;
  pool_pledge_influence?: Rational | null;
  pool_voting_thresholds?: PoolVotingThresholds | null;
  treasury_growth_rate?: Rational | null;
}

interface ProtocolVersion {
  major: number;
  minor: number;
}

interface Rational {
  denominator: number;
  numerator: number;
}

interface Redeemer {
  data: PlutusData;
  ex_units: ExUnits;
  index: number;
  tag: RedeemerTag;
}

type RedeemerTag =
  | {
      tag: 'Spend';
    }
  | {
      tag: 'Mint';
    }
  | {
      tag: 'Cert';
    }
  | {
      tag: 'Reward';
    }
  | {
      tag: 'Vote';
    }
  | {
      tag: 'Propose';
    };

type Relay =
  | {
      ipv4?: string | null;
      ipv6?: string | null;
      port?: number | null;
      relay_type: 'SingleHostAddr';
    }
  | {
      hostname: string;
      port?: number | null;
      relay_type: 'SingleHostName';
    }
  | {
      hostname: string;
      relay_type: 'MultiHostName';
    };

type ScriptInfo =
  | {
      policy_id: string;
      script_info_type: 'Minting';
    }
  | {
      datum?: PlutusData | null;
      script_info_type: 'Spending';
      utxo_ref: TransactionInput;
    }
  | {
      script_info_type: 'Rewarding';
      stake_credential: StakeCredential;
    }
  | {
      certificate: Certificate;
      index: number;
      script_info_type: 'Certifying';
    }
  | {
      script_info_type: 'Voting';
      voter: Voter;
    }
  | {
      index: number;
      proposal: ProposalProcedure;
      script_info_type: 'Proposing';
    };

type ScriptPurpose =
  | {
      policy_id: string;
      purpose_type: 'Minting';
    }
  | {
      purpose_type: 'Spending';
      utxo_ref: TransactionInput;
    }
  | {
      purpose_type: 'Rewarding';
      stake_credential: StakeCredential;
    }
  | {
      certificate: Certificate;
      index: number;
      purpose_type: 'Certifying';
    }
  | {
      purpose_type: 'Voting';
      voter: Voter;
    }
  | {
      index: number;
      proposal: ProposalProcedure;
      purpose_type: 'Proposing';
    };

type ScriptRef =
  | {
      script: string;
      script_type: 'NativeScript';
    }
  | {
      script: string;
      script_type: 'PlutusV1Script';
    }
  | {
      script: string;
      script_type: 'PlutusV2Script';
    }
  | {
      script: string;
      script_type: 'PlutusV3Script';
    };

type StakeCredential =
  | {
      credential_type: 'KeyHash';
      hash: string;
    }
  | {
      credential_type: 'ScriptHash';
      hash: string;
    };

interface TimeRange {
  lower_bound?: number | null;
  upper_bound?: number | null;
}

interface Token {
  asset_name: string;
  quantity: number;
}

interface TransactionInput {
  index: number;
  transaction_id: string;
}

type TransactionOutput =
  | {
      address: string;
      output_format: 'Legacy';
      value: CardanoValue;
    }
  | {
      address: string;
      datum_option?: DatumOption | null;
      output_format: 'PostAlonzo';
      script_ref?: ScriptRef | null;
      value: CardanoValue;
    };

interface TxInInfo {
  out_ref: TransactionInput;
  resolved: TransactionOutput;
}

type TxInfo =
  | {
      V1: TxInfoV1;
    }
  | {
      V2: TxInfoV2;
    }
  | {
      V3: TxInfoV3;
    };

interface TxInfoV1 {
  certificates: Certificate[];
  data: unknown[][];
  fee: CardanoValue;
  id: string;
  inputs: TxInInfo[];
  mint: MintValue;
  outputs: TransactionOutput[];
  redeemers: unknown[][];
  signatories: string[];
  valid_range: TimeRange;
  withdrawals: unknown[][];
}

interface TxInfoV2 {
  certificates: Certificate[];
  data: unknown[][];
  fee: CardanoValue;
  id: string;
  inputs: TxInInfo[];
  mint: MintValue;
  outputs: TransactionOutput[];
  redeemers: unknown[][];
  reference_inputs: TxInInfo[];
  signatories: string[];
  valid_range: TimeRange;
  withdrawals: unknown[][];
}

interface TxInfoV3 {
  certificates: Certificate[];
  current_treasury_amount?: number | null;
  data: unknown[][];
  fee: number;
  id: string;
  inputs: TxInInfo[];
  mint: MintValue;
  outputs: TransactionOutput[];
  proposal_procedures: ProposalProcedure[];
  redeemers: unknown[][];
  reference_inputs: TxInInfo[];
  signatories: string[];
  treasury_donation?: number | null;
  valid_range: TimeRange;
  votes: unknown[][];
  withdrawals: unknown[][];
}

type Vote =
  | {
      vote_type: 'No';
    }
  | {
      vote_type: 'Yes';
    }
  | {
      vote_type: 'Abstain';
    };

type Voter =
  | {
      hash: string;
      voter_type: 'ConstitutionalCommitteeScript';
    }
  | {
      hash: string;
      voter_type: 'ConstitutionalCommitteeKey';
    }
  | {
      hash: string;
      voter_type: 'DRepScript';
    }
  | {
      hash: string;
      voter_type: 'DRepKey';
    }
  | {
      hash: string;
      voter_type: 'StakePoolKey';
    };

interface VotingProcedure {
  anchor?: Anchor | null;
  vote: Vote;
}

// === Utility Types ===
type TransactionHash = string;
type ScriptHash = string;
type Address = string;
type AssetName = string;
type PolicyId = string;

// === Exports ===
export type { Anchor };
export type { Asset };
export type { Budget };
export type { BuiltinRuntime };
export type { CardanoValue };
export type { Certificate };
export type { Constant };
export type { Constitution };
export type { CostModels };
export type { DRep };
export type { DRepVotingThresholds };
export type { DatumOption };
export type { EitherTermOrId };
export type { Env };
export type { ExUnitPrices };
export type { ExUnits };
export type { ExecutionStatus };
export type { GovAction };
export type { GovActionId };
export type { KeyValuePair };
export type { MachineContext };
export type { MachineState };
export type { MintValue };
export type { PlutusData };
export type { PoolMetadata };
export type { PoolParams };
export type { PoolVotingThresholds };
export type { ProposalProcedure };
export type { ProtocolParamsUpdate };
export type { ProtocolVersion };
export type { Rational };
export type { Redeemer };
export type { RedeemerTag };
export type { Relay };
export type { ScriptContext };
export type { ScriptInfo };
export type { ScriptPurpose };
export type { ScriptRef };
export type { StakeCredential };
export type { Term };
export type { TimeRange };
export type { Token };
export type { TransactionInput };
export type { TransactionOutput };
export type { TxInInfo };
export type { TxInfo };
export type { TxInfoV1 };
export type { TxInfoV2 };
export type { TxInfoV3 };
export type { Type };
export type { Value };
export type { Vote };
export type { Voter };
export type { VotingProcedure };
export type { TransactionHash, ScriptHash, Address, AssetName, PolicyId };