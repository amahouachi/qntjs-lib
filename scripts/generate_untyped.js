import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(process.cwd(), 'dist', 'untyped');
const outFile = path.resolve(outDir, 'index.js');
const dtsOut = path.resolve(outDir, 'index.d.ts');
const bundledDts = path.resolve(process.cwd(), 'dist', 'bundle', 'index.d.ts');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Runtime wrapper: convert numeric typed arrays -> plain number[] and recursively map tuples/arrays
const runtimeWrapper = `// Generated untyped wrapper — converts numeric TypedArrays -> number[] and recursively maps tuples/arrays
import * as core from '../bundle/index.js';

function convert(val) {
  if (val instanceof Float64Array || val instanceof Float32Array || val instanceof Int32Array || val instanceof Uint32Array || val instanceof Int16Array || val instanceof Uint16Array || val instanceof Int8Array || val instanceof Uint8Array) {
    return Array.from(val);
  }
  if (Array.isArray(val)) return val.map(convert);
  return val;
}

function wrapNamespace(ns) {
  const out = {};
  for (const k of Object.keys(ns)) {
    const v = ns[k];
    if (typeof v === 'function') {
      out[k] = (...args) => convert(v(...args));
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const math = wrapNamespace(core.math || {});
export const ta = wrapNamespace(core.ta || {});
export const arr = wrapNamespace(core.arr || {});
export const stats = wrapNamespace(core.stats || {});
export const perf = wrapNamespace(core.perf || {});

const _default = { math, ta, arr, stats, perf };
export default _default;
`;

fs.writeFileSync(outFile, runtimeWrapper, 'utf8');
console.log('Wrote', outFile);

// Parse the bundled .d.ts using TypeScript compiler API
const sourceText = fs.readFileSync(bundledDts, 'utf8');
const sourceFile = ts.createSourceFile(
  bundledDts,
  sourceText,
  ts.ScriptTarget.Latest,
  true
);

const functionMap = new Map(); // functionName -> { params, returnType, jsDoc }
const typeAliases = []; // Store type aliases to include
const namespaceMembers = { math: new Set(), ta: new Set(), arr: new Set(), stats: new Set(), perf: new Set() };

// First pass: collect all function declarations with JSDoc and type aliases
function extractFunctions(node) {
  // Extract type aliases
  if (ts.isTypeAliasDeclaration(node)) {
    const typeName = node.name.text;
    
    // Skip mangled type aliases (they reference the real ones)
    if (typeName.includes('_d') || typeName.includes('$')) {
      return;
    }
    
    // Extract JSDoc
    const fullStart = node.getFullStart();
    const start = node.getStart(sourceFile);
    const precedingText = sourceText.substring(fullStart, start);
    const jsDocMatch = precedingText.match(/(\/\*\*[\s\S]*?\*\/)\s*$/);
    
    // Get the type declaration
    const typeText = sourceText.substring(start, node.getEnd()).trim();
    
    let fullTypeDecl = '';
    if (jsDocMatch) {
      fullTypeDecl = jsDocMatch[1] + '\n';
    }
    fullTypeDecl += 'export ' + typeText;
    
    typeAliases.push(fullTypeDecl);
    return;
  }
  
  if (ts.isFunctionDeclaration(node) && node.name) {
    const functionName = node.name.text;
    
    // Extract JSDoc comment - get everything before the function declaration
    let jsDocText = '';
    const fullStart = node.getFullStart();
    const start = node.getStart(sourceFile);
    const precedingText = sourceText.substring(fullStart, start);
    
    // Extract JSDoc block (/** ... */)
    const jsDocMatch = precedingText.match(/(\/\*\*[\s\S]*?\*\/)\s*$/);
    if (jsDocMatch) {
      jsDocText = jsDocMatch[1];
    }
    
    // Extract parameters with their types
    const params = node.parameters.map(p => {
      const paramName = p.name.getText(sourceFile);
      const paramType = p.type ? p.type.getText(sourceFile) : 'any';
      const optional = p.questionToken ? '?' : '';
      const initializer = p.initializer ? ` = ${p.initializer.getText(sourceFile)}` : '';
      return `${paramName}${optional}: ${paramType}${initializer}`;
    }).join(', ');
    
    // Extract type parameters (generics like <T>)
    let typeParams = '';
    if (node.typeParameters && node.typeParameters.length > 0) {
      const typeParamsList = node.typeParameters.map(tp => tp.getText(sourceFile)).join(', ');
      typeParams = `<${typeParamsList}>`;
    }
    
    // Extract and transform return type (TypedArray -> number[])
    let returnType = 'void';
    if (node.type) {
      returnType = node.type.getText(sourceFile)
        .replace(/(?:Float64Array|Float32Array|Int32Array|Uint32Array|Int16Array|Uint16Array|Int8Array|Uint8Array)(<[^>]+>)?/g, 'number[]');
    }
    
    functionMap.set(functionName, {
      name: functionName,
      params,
      typeParams,
      returnType,
      jsDoc: jsDocText
    });
  }
  
  ts.forEachChild(node, extractFunctions);
}

extractFunctions(sourceFile);

// Second pass: map namespaces to their members
const namespaceAliases = new Map(); // mangled name -> actual name
sourceFile.forEachChild(node => {
  // Find: export { arr_d as arr, index_d$2 as math, ... }
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    node.exportClause.elements.forEach(element => {
      const exportedName = element.name.text; // 'arr', 'math', etc.
      const propertyName = element.propertyName?.text; // 'arr_d', 'index_d$2', etc.
      
      if (['math', 'ta', 'arr', 'stats', 'perf'].includes(exportedName) && propertyName) {
        namespaceAliases.set(propertyName, exportedName);
      }
    });
  }
});

// Third pass: find namespace members
sourceFile.forEachChild(node => {
  if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
    const mangledName = node.name.text;
    const actualName = namespaceAliases.get(mangledName);
    
    if (actualName && namespaceMembers[actualName]) {
      node.body.statements.forEach(stmt => {
        if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
          stmt.exportClause.elements.forEach(element => {
            const memberName = element.name.text;
            const propertyName = element.propertyName?.text || memberName;
            
            // Extract the base function name (remove 'index_d_' prefix if present)
            const baseName = propertyName.replace(/^index_d[_$\d]*_/, '');
            namespaceMembers[actualName].add(baseName);
          });
        }
      });
    }
  }
});

// Generate type declarations
let typeDeclaration = `// Generated untyped declarations with JSDoc preserved\n\n`;

// Add type aliases first
if (typeAliases.length > 0) {
  typeDeclaration += typeAliases.join('\n\n') + '\n\n';
}

// Generate namespaces with their functions
for (const [nsName, members] of Object.entries(namespaceMembers)) {
  typeDeclaration += `declare namespace ${nsName} {\n`;
  
  for (const memberName of members) {
    const func = functionMap.get(memberName);
    if (func) {
      // Add JSDoc if present
      if (func.jsDoc) {
        const jsDocLines = func.jsDoc.split('\n');
        jsDocLines.forEach(line => {
          typeDeclaration += `  ${line}\n`;
        });
      }
      typeDeclaration += `  export function ${func.name}${func.typeParams}(${func.params}): ${func.returnType};\n`;
    }
  }
  
  typeDeclaration += `}\n\n`;
}

typeDeclaration += `export { math, ta, arr, stats, perf };\n`;

fs.writeFileSync(dtsOut, typeDeclaration, 'utf8');
console.log('Wrote', dtsOut);
