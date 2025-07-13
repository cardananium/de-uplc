import { Type } from "./type";

export type Name = string;
export type IntegerNumber = bigint;
export type BytesInHex = string;
export type PlutusData = any; 

// Raw field element (blst_fp): 6 limbs of u64 (384 bits total)
export type BlstFp = [bigint, bigint, bigint, bigint, bigint, bigint];

// Fp2 element (blst_fp2): array of 2 blst_fp elements
export type BlstFp2 = [BlstFp, BlstFp];

// Fp6 element (blst_fp6): array of 3 blst_fp2 elements  
export type BlstFp6 = [BlstFp2, BlstFp2, BlstFp2];

// BLS12-381 G1 point (blst_p1 structure)
// Jacobian coordinates over base field Fp
export type BlstP1 = {
    x: BlstFp; // blst_fp (6 u64 limbs)
    y: BlstFp; // blst_fp (6 u64 limbs)
    z: BlstFp; // blst_fp (6 u64 limbs) for Jacobian coordinates
};

// BLS12-381 G2 point (blst_p2 structure)
// Jacobian coordinates over extension field Fp2
export type BlstP2 = {
    x: BlstFp2; // blst_fp2 (2 blst_fp elements)
    y: BlstFp2; // blst_fp2 (2 blst_fp elements) 
    z: BlstFp2; // blst_fp2 (2 blst_fp elements) for Jacobian coordinates
};

// BLS12-381 Fp12 element (blst_fp12 structure)
// Result of Miller loop operations: array of 2 blst_fp6 elements
export type BlstFp12 = [BlstFp6, BlstFp6];

export type Constant =
    | { type: "Integer", value: IntegerNumber }
    | { type: "ByteString", value: BytesInHex }
    | { type: "String", value: string }
    | { type: "UsignedInteger", value: IntegerNumber }
    | { type: "Bool", value: boolean }
    | { type: "ProtoList", elementType: Type, values: Constant[] }
    | { type: "ProtoPair", first_type: Type, second_type: Type, first_element: Constant, second_element: Constant }
    | { type: "Data", data: PlutusData }
    | { type: "Bls12_381G1Element", value: BlstP1 }
    | { type: "Bls12_381G2Element", value: BlstP2 }
    | { type: "Bls12_381MlResult", value: BlstFp12 };