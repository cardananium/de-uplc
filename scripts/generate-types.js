const fs = require('fs');
const path = require('path');
const { compile } = require('json-schema-to-typescript');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'debugger-types');
const COMBINED_SCHEMA_PATH = path.join(__dirname, '..', 'rust-src', 'schemas', 'combined_schema.json');

// Root schemas that are returned from public API methods
const ROOT_SCHEMAS = [
    'SerializableScriptContext',
    'SerializableMachineContext',
    'SerializableMachineState', 
    'SerializableBudget',
    'SerializableTerm',
    'SerializableValue',
    'SerializableExecutionStatus',
    'SerializableMachineStateLazy',
    'SerializableMachineContextLazy',
    'SerializableValueLazy',
    'SerializableEnvLazy'
];

/**
 * Remove "Serializable" prefix from type names
 */
function cleanTypeName(name) {
    return name.replace(/^Serializable/, '');
}

/**
 * Fix references in schema to use clean type names and handle root references
 */
function fixReferences(obj, renameMap, contextRootName = null) {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(item => fixReferences(item, renameMap, contextRootName));
    }
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
            // Handle self-reference to root schema
            // When processing a schema file, $ref: "#" means reference to the root of that file
            // We need to find which original schema this came from and use the correct type name
            if (value === '#') {
                // This is a reference to the root schema of the original file
                // For LazyLoadableEnv in SerializableEnvLazy.json, this would be SerializableEnvLazy
                // which should become EnvLazy
                if (contextRootName) {
                    // Replace with a reference to the clean root name in $defs
                    result[key] = `#/$defs/${contextRootName}`;
                } else {
                    result[key] = value;
                }
            } else {
                // Extract the reference name and apply renaming
                const match = value.match(/#\/\$defs\/(.+)$/);
                if (match && renameMap.has(match[1])) {
                    result[key] = `#/$defs/${renameMap.get(match[1])}`;
                } else {
                    result[key] = value;
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            result[key] = fixReferences(value, renameMap, contextRootName);
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Fix tuple types that json-schema-to-typescript generates as any[][]
 * These are typically pairs or tuples in Rust that get serialized
 */
function fixTupleTypes(ts) {
    // Known tuple type patterns in TxInfo
    const tupleReplacements = [
        // data: any[][] -> data: [string, PlutusData][]
        { pattern: /(\s+data:\s*)any\[\]\[\]/g, replacement: '$1[string, PlutusData][]' },
        
        // redeemers: any[][] -> redeemers: [ScriptPurpose, Redeemer][]
        { pattern: /(\s+redeemers:\s*)any\[\]\[\]/g, replacement: '$1[ScriptPurpose, Redeemer][]' },
        
        // withdrawals: any[][] -> withdrawals: [string, number][]
        { pattern: /(\s+withdrawals:\s*)any\[\]\[\]/g, replacement: '$1[string, number][]' },
        
        // votes: any[][] -> votes: [Voter, [GovActionId, VotingProcedure][]][]
        { pattern: /(\s+votes:\s*)any\[\]\[\]/g, replacement: '$1[Voter, [GovActionId, VotingProcedure][]][]' },
    ];
    
    for (const { pattern, replacement } of tupleReplacements) {
        ts = ts.replace(pattern, replacement);
    }
    
    return ts;
}

/**
 * Extract just the type definition from generated TypeScript
 */
function extractTypeDefinition(ts, typeName) {
    // Remove exports and comments
    ts = ts
        .replace(/export\s+(type|interface)/g, '$1')
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\[k: string\]: unknown;?\s*/g, '')
        .trim();
    
    // Find the type definition - handle multiline types correctly
    const lines = ts.split('\n');
    let inType = false;
    let braceCount = 0;
    let parenCount = 0;
    let typeLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const typeMatch = line.match(new RegExp(`^(type|interface)\\s+${typeName}\\b`));
        
        if (typeMatch && !inType) {
            inType = true;
            typeLines = [line];
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            parenCount += (line.match(/\(/g) || []).length;
            parenCount -= (line.match(/\)/g) || []).length;
        } else if (inType) {
            typeLines.push(line);
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            parenCount += (line.match(/\(/g) || []).length;
            parenCount -= (line.match(/\)/g) || []).length;
            
            // Check if we've reached the end of the type definition
            if (braceCount === 0 && parenCount === 0) {
                // Look ahead to see if next line starts with | (union type continuation)
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
                    continue;
                }
                // Check if this line ends the type
                if (trimmedLine === ';' || trimmedLine.endsWith(';') || 
                    (trimmedLine.endsWith('}') && !lines[i + 1]?.trim().startsWith('|'))) {
                    return typeLines.join('\n').trim();
                }
                // For interface, check if we're at the closing brace
                if (typeMatch && typeMatch[1] === 'interface' && trimmedLine === '}') {
                    return typeLines.join('\n').trim();
                }
            }
        }
    }
    
    return typeLines.length > 0 ? typeLines.join('\n').trim() : null;
}

/**
 * Generate TypeScript types from schemas
 */
async function generateTypes() {
    console.log('🚀 Generating TypeScript types from JSON schemas...');
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Check if combined schema exists
    if (!fs.existsSync(COMBINED_SCHEMA_PATH)) {
        console.error(`❌ Combined schema file not found: ${COMBINED_SCHEMA_PATH}`);
        console.log('💡 Run "npm run generate-schemas" first to generate the schemas.');
        process.exit(1);
    }
    
    try {
        // Load combined schema
        console.log('📄 Loading combined schema...');
        const combinedSchema = JSON.parse(fs.readFileSync(COMBINED_SCHEMA_PATH, 'utf8'));
        console.log(`   Found ${Object.keys(combinedSchema.schemas).length} schemas`);
        
        // Collect all unique type schemas and build rename map
        const allTypes = new Map(); // Clean name -> schema
        const renameMap = new Map(); // Original name -> clean name
        const allDefs = {}; // All definitions for reference resolution
        const typeOrigins = new Map(); // Clean name -> original root schema name
        
        // Process all schemas and their definitions
        for (const [schemaName, schema] of Object.entries(combinedSchema.schemas)) {
            const cleanName = cleanTypeName(schemaName);
            renameMap.set(schemaName, cleanName);
            
            // Add main schema
            if (!allTypes.has(cleanName)) {
                const schemaCopy = { ...schema };
                delete schemaCopy.$defs; // Remove nested defs from main schema
                allTypes.set(cleanName, schemaCopy);
                allDefs[cleanName] = schemaCopy;
                typeOrigins.set(cleanName, cleanName); // Root schema originates from itself
                // Also keep original name in allDefs for reference resolution
                if (schemaName !== cleanName) {
                    allDefs[schemaName] = schemaCopy;
                }
            }
            
            // Process nested definitions
            if (schema.$defs) {
                for (const [defName, defSchema] of Object.entries(schema.$defs)) {
                    const cleanDefName = cleanTypeName(defName);
                    renameMap.set(defName, cleanDefName);
                    
                    if (!allTypes.has(cleanDefName)) {
                        allTypes.set(cleanDefName, defSchema);
                        allDefs[cleanDefName] = defSchema;
                        typeOrigins.set(cleanDefName, cleanName); // Track which root schema this came from
                        // Also keep original name in allDefs for reference resolution
                        if (defName !== cleanDefName) {
                            allDefs[defName] = defSchema;
                        }
                    }
                }
            }
        }
        
        console.log(`   Found ${allTypes.size} unique types to generate`);
        
        // Add all possible Serializable* references to rename map
        for (const key of Object.keys(allDefs)) {
            renameMap.set(`Serializable${key}`, key);
        }
        
        // Generate TypeScript for each type
        const typeDefinitions = [];
        const processedTypes = new Set();
        
        for (const [typeName, schema] of allTypes) {
            if (processedTypes.has(typeName)) continue;
            
            try {
                console.log(`📄 Processing ${typeName}...`);
                
                // Fix all references in definitions
                // For each $def, use its own name when fixing self-references
                const fixedDefs = {};
                for (const [defName, defSchema] of Object.entries(allDefs)) {
                    fixedDefs[defName] = fixReferences(defSchema, renameMap, defName);
                }
                
                // Create a schema with this type and all dependencies
                const typeSchema = {
                    ...fixReferences(schema, renameMap, typeName),
                    title: typeName, // Force the type name
                    $defs: fixedDefs
                };
                
                // Generate TypeScript
                let ts = await compile(typeSchema, typeName, {
                    bannerComment: '',
                    style: {
                        bracketSpacing: true,
                        printWidth: 120,
                        semi: true,
                        singleQuote: true,
                        tabWidth: 2,
                        trailingComma: 'es5',
                        useTabs: false,
                    },
                    unreachableDefinitions: false,
                    declareExternallyReferenced: false,
                    enableConstEnums: false,
                    ignoreMinAndMaxItems: true,
                    additionalProperties: false,
                    unknownAny: false,
                });
                
                // Replace any remaining Serializable* type references
                ts = ts.replace(/Serializable([A-Z]\w*)/g, '$1');
                
                // Fix TypeName1 conflicts caused by $defs containing the same type name
                // When json-schema-to-typescript sees a type in $defs with the same name as the root,
                // it adds a "1" suffix. We need to remove this suffix.
                for (const defName of Object.keys(allDefs)) {
                    const regex = new RegExp(`\\b${defName}1\\b`, 'g');
                    ts = ts.replace(regex, defName);
                }
                
                // Fix tuple types that were generated as any[][]
                // json-schema-to-typescript doesn't handle prefixItems (tuples) well
                ts = fixTupleTypes(ts);
                
                // Extract just the type definition for this type
                const typeDef = extractTypeDefinition(ts, typeName);
                
                if (typeDef) {
                    typeDefinitions.push(typeDef);
                    processedTypes.add(typeName);
                    
                    // Determine if this is a root type
                    const isRootType = ROOT_SCHEMAS.map(s => cleanTypeName(s)).includes(typeName);
                    console.log(isRootType ? `   ✅ Generated root type: ${typeName}` : `   ✅ Generated type: ${typeName}`);
                } else {
                    console.log(`   ⚠️  Could not extract type definition for ${typeName}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Failed to generate ${typeName}: ${error.message}`);
            }
        }
        
        console.log(`\n   Total: ${processedTypes.size} types generated`);
        
        // Sort types alphabetically
        typeDefinitions.sort((a, b) => {
            const nameA = a.match(/^(type|interface)\s+(\w+)/)?.[2] || '';
            const nameB = b.match(/^(type|interface)\s+(\w+)/)?.[2] || '';
            return nameA.localeCompare(nameB);
        });
        
        // Build the final output
        const output = [
            '// Auto-generated TypeScript types from Rust JSON schemas',
            '// Generated by scripts/generate-types.js',
            '',
            ...typeDefinitions,
            '',
            '// Utility type aliases',
            'type TransactionHash = string;',
            'type ScriptHash = string;',
            'type Address = string;',
            'type AssetName = string;',
            'type PolicyId = string;',
            '',
            '// Exports',
            ...Array.from(processedTypes).sort().map(name => `export type { ${name} };`),
            'export type { TransactionHash, ScriptHash, Address, AssetName, PolicyId };',
            ''
        ].join('\n\n');
        
        // Write the final file
        fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), output, 'utf8');
        
        console.log(`\n✅ Successfully generated ${processedTypes.size} types!`);
        console.log(`📁 Output written to: ${path.join(OUTPUT_DIR, 'index.ts')}`);
        
        // Verify root types
        console.log('\n📋 Root types:');
        for (const schema of ROOT_SCHEMAS) {
            const cleanName = cleanTypeName(schema);
            if (processedTypes.has(cleanName)) {
                console.log(`   ✓ ${cleanName}`);
            } else {
                console.log(`   ✗ ${cleanName} (missing)`);
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to generate types:', error);
        process.exit(1);
    }
}

// Run the generator
generateTypes().catch(console.error);