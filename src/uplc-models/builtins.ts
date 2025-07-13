import { IntegerNumber } from "./constant";
import { Value } from "./value";

export type DefaultFunction =
    // Integer functions
    "AddInteger" |
    "SubtractInteger" |
    "MultiplyInteger" |
    "DivideInteger" |
    "QuotientInteger" |
    "RemainderInteger" |
    "ModInteger" |
    "EqualsInteger" |
    "LessThanInteger" |
    "LessThanEqualsInteger" |

    // ByteString functions
    "AppendByteString" |
    "ConsByteString" |
    "SliceByteString" |
    "LengthOfByteString" |
    "IndexByteString" |
    "EqualsByteString" |
    "LessThanByteString" |
    "LessThanEqualsByteString" |

    // Hashing functions
    "Sha2_256" |
    "Sha3_256" |
    "Blake2b_256" |
    "Keccak_256" |
    "Blake2b_224" |

    // Signature verification
    "VerifyEd25519Signature" |
    "VerifyEcdsaSecp256k1Signature" |
    "VerifySchnorrSecp256k1Signature" |

    // String functions
    "AppendString" |
    "EqualsString" |
    "EncodeUtf8" |
    "DecodeUtf8" |

    // Control flow
    "IfThenElse" |
    "ChooseUnit" |
    "Trace" |

    // Pair functions
    "FstPair" |
    "SndPair" |

    // List functions
    "ChooseList" |
    "MkCons" |
    "HeadList" |
    "TailList" |
    "NullList" |

    // Data functions
    "ChooseData" |
    "ConstrData" |
    "MapData" |
    "ListData" |
    "IData" |
    "BData" |
    "UnConstrData" |
    "UnMapData" |
    "UnListData" |
    "UnIData" |
    "UnBData" |
    "EqualsData" |
    "SerialiseData" |
    "MkPairData" |
    "MkNilData" |
    "MkNilPairData" |

    // BLS12-381 functions
    "Bls12_381_G1_Add" |
    "Bls12_381_G1_Neg" |
    "Bls12_381_G1_ScalarMul" |
    "Bls12_381_G1_Equal" |
    "Bls12_381_G1_Compress" |
    "Bls12_381_G1_Uncompress" |
    "Bls12_381_G1_HashToGroup" |
    "Bls12_381_G2_Add" |
    "Bls12_381_G2_Neg" |
    "Bls12_381_G2_ScalarMul" |
    "Bls12_381_G2_Equal" |
    "Bls12_381_G2_Compress" |
    "Bls12_381_G2_Uncompress" |
    "Bls12_381_G2_HashToGroup" |
    "Bls12_381_MillerLoop" |
    "Bls12_381_MulMlResult" |
    "Bls12_381_FinalVerify" |

    // Bitwise / conversion functions
    "IntegerToByteString" |
    "ByteStringToInteger";

export interface BuiltinRuntime {
    args: Value[];
    fun: DefaultFunction;
    current_forces: IntegerNumber;
    arity: IntegerNumber;
    function_force_count: IntegerNumber;
}