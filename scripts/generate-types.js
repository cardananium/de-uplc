#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { compileFromFile } = require('json-schema-to-typescript');

const SCHEMAS_DIR = path.join(__dirname, '../rust-src/schemas');
const COMBINED_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'combined_schema.json');
const OUTPUT_DIR = path.join(__dirname, '../src/debugger-types');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'index.ts');

// Root schemas that should be generated
const ROOT_SCHEMAS = [
    'SerializableScriptContext',
    'SerializableContext', 
    'SerializableMachineState',
    'SerializableBudget',
    'SerializableTerm',
    'SerializableValue',
    'SerializableExecutionStatus'
];

/**
 * Remove "Serializable" prefix from type names
 */
function cleanTypeName(name) {
    return name.replace(/^Serializable/, '');
}

/**
 * Create a standalone schema file for a specific type from combined schema
 */
function createStandaloneSchema(combinedSchema, typeName) {
    const schema = combinedSchema.schemas[typeName];
    if (!schema) {
        throw new Error(`Schema ${typeName} not found in combined schema`);
    }
    
    // Create a complete schema with all definitions
    const standaloneSchema = {
        ...schema,
        title: cleanTypeName(typeName),
        $defs: {}
    };
    
    // Extract all $defs from all schemas in combined schema
    // This ensures all references can be resolved
    Object.values(combinedSchema.schemas).forEach(schemaItem => {
        if (schemaItem.$defs) {
            Object.assign(standaloneSchema.$defs, schemaItem.$defs);
        }
    });
    
    // Also add the schemas themselves as definitions with cleaned names
    Object.entries(combinedSchema.schemas).forEach(([schemaName, schemaItem]) => {
        const cleanName = cleanTypeName(schemaName);
        standaloneSchema.$defs[cleanName] = {
            ...schemaItem,
            title: cleanName
        };
        
        // Also keep the original name for backward compatibility
        standaloneSchema.$defs[schemaName] = {
            ...schemaItem,
            title: cleanName
        };
    });
    
    return standaloneSchema;
}

/**
 * Normalize schema for comparison by removing titles and sorting properties
 */
function normalizeSchemaForComparison(schema) {
    if (typeof schema !== 'object' || schema === null) {
        return schema;
    }
    
    if (Array.isArray(schema)) {
        return schema.map(normalizeSchemaForComparison);
    }
    
    const normalized = {};
    const keys = Object.keys(schema).filter(key => key !== 'title').sort();
    
    for (const key of keys) {
        if (key === '$ref') {
            // Normalize references by removing "Serializable" prefix
            normalized[key] = schema[key].replace(/Serializable([A-Z])/g, '$1');
        } else {
            normalized[key] = normalizeSchemaForComparison(schema[key]);
        }
    }
    
    return normalized;
}

/**
 * Create a hash of schema content for deduplication
 */
function createSchemaHash(schema) {
    // Create a normalized version of the schema for comparison
    const normalized = normalizeSchemaForComparison(schema);
    const normalizedString = JSON.stringify(normalized);
    return require('crypto').createHash('md5').update(normalizedString).digest('hex');
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
    
    const generatedTypes = new Set();
    const schemaHashes = new Map(); // Map from hash to type name for deduplication
    const typeDefinitions = [];
    const tempFiles = [];
    
    try {
        // Load combined schema
        console.log('📄 Loading combined schema...');
        const combinedSchema = JSON.parse(fs.readFileSync(COMBINED_SCHEMA_PATH, 'utf8'));
        console.log(`   Found ${Object.keys(combinedSchema.schemas).length} schemas`);
        
        // Collect all schemas and their $defs with deduplication by content
        const allSchemasToProcess = new Map();
        const deduplicationMap = new Map(); // Maps original name to canonical name
        
        // Add main schemas
        Object.entries(combinedSchema.schemas).forEach(([schemaName, schemaItem]) => {
            const typeName = cleanTypeName(schemaName);
            const schemaHash = createSchemaHash(schemaItem);
            
            if (schemaHashes.has(schemaHash)) {
                const existingTypeName = schemaHashes.get(schemaHash);
                console.log(`   🔄 Found duplicate schema: ${typeName} -> ${existingTypeName}`);
                deduplicationMap.set(schemaName, existingTypeName);
            } else {
                schemaHashes.set(schemaHash, typeName);
                allSchemasToProcess.set(schemaName, schemaItem);
            }
            
            // Add $defs from this schema with deduplication
            if (schemaItem.$defs) {
                Object.entries(schemaItem.$defs).forEach(([defName, defItem]) => {
                    const defTypeName = cleanTypeName(defName);
                    const defHash = createSchemaHash(defItem);
                    
                    if (schemaHashes.has(defHash)) {
                        const existingTypeName = schemaHashes.get(defHash);
                        console.log(`   🔄 Found duplicate $def: ${defTypeName} -> ${existingTypeName}`);
                        deduplicationMap.set(defName, existingTypeName);
                    } else if (!allSchemasToProcess.has(defName)) {
                        schemaHashes.set(defHash, defTypeName);
                        allSchemasToProcess.set(defName, defItem);
                    }
                });
            }
        });
        
        console.log(`   Found ${allSchemasToProcess.size} unique types to generate`);
        
        // Process all schemas (main + defs) individually but with deduplication
        for (const [schemaName, schemaItem] of allSchemasToProcess) {
            try {
                console.log(`📄 Processing ${schemaName}...`);
                
                const typeName = cleanTypeName(schemaName);
                
                // Skip if we've already generated this type (deduplication)
                if (generatedTypes.has(typeName)) {
                    console.log(`   ↳ Skipping duplicate type: ${typeName}`);
                    continue;
                }
                
                // Create standalone schema with all dependencies  
                const standaloneSchema = {
                    ...schemaItem,
                    title: typeName,
                    $defs: {}
                };
                
                // Add all unique schemas to $defs for reference resolution
                // Only add schemas that are different from the current one being processed
                allSchemasToProcess.forEach((item, name) => {
                    const cleanName = cleanTypeName(name);
                    
                    // Skip adding the current schema to its own $defs to avoid duplication
                    if (cleanName === typeName) {
                        return;
                    }
                    
                    standaloneSchema.$defs[cleanName] = {
                        ...item,
                        title: cleanName
                    };
                    
                    // Also keep original name for backward compatibility
                    standaloneSchema.$defs[name] = {
                        ...item,
                        title: cleanName
                    };
                    
                    // Add nested $defs if they exist
                    if (item.$defs) {
                        Object.assign(standaloneSchema.$defs, item.$defs);
                    }
                });
                
                // Write temporary schema file
                const tempSchemaPath = path.join(OUTPUT_DIR, `temp_${schemaName}.json`);
                fs.writeFileSync(tempSchemaPath, JSON.stringify(standaloneSchema, null, 2), 'utf8');
                tempFiles.push(tempSchemaPath);
                
                // Generate TypeScript interface from file
                let tsInterface = await compileFromFile(tempSchemaPath, {
                    bannerComment: '',
                    style: {
                        bracketSpacing: true,
                        printWidth: 100,
                        semi: true,
                        singleQuote: true,
                        tabWidth: 2,
                        trailingComma: 'es5',
                        useTabs: false,
                    },
                    unreachableDefinitions: true,
                    declareExternallyReferenced: false,
                    enableConstEnums: false,
                    ignoreMinAndMaxItems: true,
                    additionalProperties: false, // This removes [k: string]: unknown
                });
                
                // Clean up the generated interface
                tsInterface = tsInterface
                    .replace(/export interface /g, 'interface ')
                    .replace(/export type /g, 'type ')
                    .split('\n')
                    .filter(line => !line.trim().startsWith('export '))
                    .join('\n')
                    .replace(/\/\*\*[\s\S]*?\*\//g, '') // Remove JSDoc comments
                    .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up extra newlines
                    .replace(/Serializable([A-Z][a-zA-Z]*)/g, '$1') // Remove "Serializable" prefix from type references
                    .replace(/\[k: string\]: unknown;\s*/g, '') // Remove [k: string]: unknown
                    .trim();
                
                // Special handling for EitherTermOrId to rename the Term variant to avoid conflicts
                if (typeName === 'EitherTermOrId') {
                    // Rename the second Term definition to TermWithType to avoid duplication
                    const lines = tsInterface.split('\n');
                    let foundFirstTerm = false;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('type Term = {')) {
                            if (foundFirstTerm) {
                                lines[i] = lines[i].replace('type Term = {', 'type TermWithType = {');
                            } else {
                                foundFirstTerm = true;
                            }
                        } else if (lines[i].includes('| Term')) {
                            if (foundFirstTerm) {
                                lines[i] = lines[i].replace('| Term', '| TermWithType');
                            }
                        }
                    }
                    tsInterface = lines.join('\n');
                }
                
                // Determine if this is a root type or dependent type
                const isRootType = ROOT_SCHEMAS.map(s => cleanTypeName(s)).includes(typeName);
                
                if (isRootType) {
                    console.log(`   ✅ Generated root type: ${typeName}`);
                } else {
                    console.log(`   ✅ Generated dependent type: ${typeName}`);
                }
                
                typeDefinitions.push(tsInterface);
                typeDefinitions.push(''); // Empty line for readability
                
                generatedTypes.add(typeName);
                
            } catch (error) {
                console.error(`❌ Error processing ${schemaName}:`, error.message);
                
                // Create fallback type
                const typeName = cleanTypeName(schemaName);
                if (!generatedTypes.has(typeName)) {
                    typeDefinitions.push(`// === ${typeName} (Error Fallback) ===`);
                    typeDefinitions.push(`interface ${typeName} {
  [key: string]: unknown;
}
`);
                    typeDefinitions.push('');
                    generatedTypes.add(typeName);
                    console.log(`   🔄 Created fallback type: ${typeName}`);
                }
            }
        }
        
        // Add common utility types
        typeDefinitions.push(`// === Utility Types ===
type TransactionHash = string;
type ScriptHash = string;
type Address = string;
type AssetName = string;
type PolicyId = string;
`);
        
        // Add exports at the end
        typeDefinitions.push('// === Exports ===');
        const exportList = Array.from(generatedTypes).sort();
        exportList.forEach(typeName => {
            typeDefinitions.push(`export type { ${typeName} };`);
        });
        
        // Add utility type exports
        typeDefinitions.push('export type { TransactionHash, ScriptHash, Address, AssetName, PolicyId };');
        
        // Write the combined types file and post-process to fix duplicates
        let finalContent = typeDefinitions.join('\n');
        
        // Fix duplicate Term types and Term1 references
        const lines = finalContent.split('\n');
        let inSecondTermDef = false;
        let termDefCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            // Count Term definitions (both forms: "type Term =" and "type Term = {")
            if (lines[i].startsWith('type Term =')) {
                termDefCount++;
                if (termDefCount === 2) {
                    // This is the second Term definition - rename it
                    lines[i] = lines[i].replace('type Term =', 'type TermWithType =');
                    inSecondTermDef = true;
                }
            }
            
            // If we're in the second term definition, keep track of when it ends
            if (inSecondTermDef && lines[i].trim() === ');') {
                inSecondTermDef = false;
            }
            
            // Replace Term1 references with TermWithType
            if (lines[i].includes('Term1')) {
                lines[i] = lines[i].replace(/Term1/g, 'TermWithType');
            }
            
            // Update EitherTermOrId to use TermWithType instead of Term for the tagged variant
            if (lines[i].includes('type EitherTermOrId =')) {
                // Find the next line with | Term and replace it
                for (let j = i + 1; j < lines.length && j < i + 5; j++) {
                    if (lines[j].includes('| Term') && termDefCount >= 2) {
                        lines[j] = lines[j].replace('| Term', '| TermWithType');
                        break;
                    }
                }
            }
        }
        
        finalContent = lines.join('\n');
        
        // Add TermWithType to exports if we renamed the second Term
        if (termDefCount >= 2) {
            const exportIndex = finalContent.indexOf('export type { Term };');
            if (exportIndex !== -1) {
                finalContent = finalContent.replace(
                    'export type { Term };',
                    'export type { Term };\nexport type { TermWithType };'
                );
            }
        }
        
        fs.writeFileSync(OUTPUT_FILE, finalContent, 'utf8');
        
        console.log('');
        console.log('✨ TypeScript type generation completed!');
        console.log(`📁 Output: ${OUTPUT_FILE}`);
        console.log(`🔢 Generated ${generatedTypes.size} unique types:`);
        exportList.forEach(type => console.log(`   - ${type}`));
        console.log('');
        console.log('💡 Import types in your code:');
        console.log(`   import type { ${exportList.slice(0, 3).join(', ')} } from './debugger-types';`);
        
    } finally {
        // Clean up temporary files
        tempFiles.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (error) {
                console.warn(`⚠️  Could not delete temp file: ${file}`);
            }
        });
    }
}

// Run the script
if (require.main === module) {
    generateTypes().catch(error => {
        console.error('❌ Failed to generate types:', error);
        process.exit(1);
    });
}

module.exports = { generateTypes }; 