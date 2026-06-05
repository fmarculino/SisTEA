const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DMAC-LAB\\.gemini\\antigravity-ide\\brain\\8fdf6946-59ea-4bbd-8504-345dcd449230';
const columnsFile = path.join(brainDir, '.system_generated\\steps\\118\\output.txt');
const migrationsFile = path.join(brainDir, '.system_generated\\steps\\122\\output.txt');

function extractJsonFromUntrusted(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const outer = JSON.parse(content);
  const resultStr = outer.result;
  const startIndex = resultStr.indexOf('[');
  const endIndex = resultStr.lastIndexOf(']');
  return JSON.parse(resultStr.substring(startIndex, endIndex + 1));
}

const columnsData = extractJsonFromUntrusted(columnsFile);
const migrations = extractJsonFromUntrusted(migrationsFile);

// Build map of table -> set of columns in DB
const dbColumns = {};
columnsData.forEach(row => {
  const t = row.table_name;
  const c = row.column_name;
  if (!dbColumns[t]) dbColumns[t] = new Set();
  dbColumns[t].add(c);
});

// Now let's scan migrations for column additions and table creations
const migrationColumns = {};

const initColumnsForTable = (t) => {
  if (!migrationColumns[t]) migrationColumns[t] = new Set();
};

// Add baseline table columns created in migration_1_schema_auth.sql patches
initColumnsForTable('audit_logs');
dbColumns['audit_logs']?.forEach(c => migrationColumns['audit_logs'].add(c));
initColumnsForTable('competence_audit_logs');
dbColumns['competence_audit_logs']?.forEach(c => migrationColumns['competence_audit_logs'].add(c));
initColumnsForTable('system_metadata');
dbColumns['system_metadata']?.forEach(c => migrationColumns['system_metadata'].add(c));

migrations.forEach(m => {
  m.statements.forEach(stmt => {
    // Split the massive statements by semicolon first
    const subStmts = stmt.split(';');
    
    subStmts.forEach(subStmt => {
      const clean = subStmt.replace(/\s+/g, ' ').toLowerCase();
      
      const createTableMatch = clean.match(/create table (?:if not exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\((.*)\)/);
      if (createTableMatch) {
        const tName = createTableMatch[1];
        initColumnsForTable(tName);
        const body = createTableMatch[2];
        if (dbColumns[tName]) {
          for (const col of dbColumns[tName]) {
            const reg = new RegExp('\\b' + col + '\\b');
            if (reg.test(body)) {
              migrationColumns[tName].add(col);
            }
          }
        }
      }
      
      const alterTableMatch = clean.match(/alter table (?:public\.)?([a-zA-Z0-9_]+)\s+(?:add column|add)\s+(?:if not exists\s+)?([a-zA-Z0-9_]+)/g);
      if (alterTableMatch) {
        alterTableMatch.forEach(matchStr => {
          const parts = matchStr.match(/alter table (?:public\.)?([a-zA-Z0-9_]+)\s+(?:add column|add)\s+(?:if not exists\s+)?([a-zA-Z0-9_]+)/);
          if (parts) {
            const tName = parts[1];
            const colName = parts[2];
            initColumnsForTable(tName);
            migrationColumns[tName].add(colName);
          }
        });
      }
      
      const alterMultiMatch = clean.match(/alter table (?:public\.)?([a-zA-Z0-9_]+)\s+((?:add|alter|drop).+)/);
      if (alterMultiMatch) {
        const tName = alterMultiMatch[1];
        initColumnsForTable(tName);
        if (dbColumns[tName]) {
          for (const col of dbColumns[tName]) {
            const reg = new RegExp('\\badd\\b.*\\b' + col + '\\b');
            if (reg.test(alterMultiMatch[2])) {
              migrationColumns[tName].add(col);
            }
          }
        }
      }
    });
  });
});

console.log("Missing columns (exist in DB schema but not found in migration statements):");
let foundMissing = false;
for (const tName in dbColumns) {
  if (tName === 'view_competence_billing_sums') continue; // View columns are computed
  
  const dbCols = dbColumns[tName];
  const migCols = migrationColumns[tName] || new Set();
  const missing = [];
  
  dbCols.forEach(col => {
    if (!migCols.has(col)) {
      missing.push(col);
    }
  });
  
  if (missing.length > 0) {
    console.log(`Table public.${tName}:`);
    missing.forEach(col => {
      const cData = columnsData.find(row => row.table_name === tName && row.column_name === col);
      console.log(`  - ${col} (${cData ? cData.udt_name : 'unknown'})`);
    });
    foundMissing = true;
  }
}
if (!foundMissing) {
  console.log("None! All columns accounted for.");
}
