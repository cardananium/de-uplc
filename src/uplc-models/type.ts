export type Type =
    | { type: "Bool" }
    | { type: "Integer" }
    | { type: "String" }
    | { type: "ByteString" }
    | { type: "Unit" }
    | { type: "List", elementType: Type }
    | { type: "Pair", first_type: Type, second_type: Type }
    | { type: "Data" }
    | { type: "Bls12_381G1Element" }
    | { type: "Bls12_381G2Element" }
    | { type: "Bls12_381MlResult" };