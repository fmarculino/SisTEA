const fs = require('fs');
const path = require('path');

// Configure absolute paths for the brain outputs and scratch directory
const brainDir = 'C:\\Users\\DMAC-LAB\\.gemini\\antigravity-ide\\brain\\8fdf6946-59ea-4bbd-8504-345dcd449230';
const columnsFile = path.join(brainDir, '.system_generated\\steps\\118\\output.txt');
const migrationsFile = path.join(brainDir, '.system_generated\\steps\\122\\output.txt');
const tableDataFile = path.join(brainDir, '.system_generated\\steps\\130\\output.txt');

const authUsersFile = 'c:\\Users\\DMAC-LAB\\SisTEA\\scratch\\auth_users.json';
const authIdentitiesFile = 'c:\\Users\\DMAC-LAB\\SisTEA\\scratch\\auth_identities.json';
const outputFile = 'c:\\Users\\DMAC-LAB\\SisTEA\\scratch\\migration_dump.sql';

// Helper to extract JSON from untrusted data tags
function extractJsonFromUntrusted(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const outer = JSON.parse(content);
  const resultStr = outer.result;
  const startIndex = resultStr.indexOf('[');
  const endIndex = resultStr.lastIndexOf(']');
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    throw new Error(`Could not find JSON array boundaries in ${filePath}`);
  }
  return JSON.parse(resultStr.substring(startIndex, endIndex + 1));
}

function escapeSqlValue(val, type) {
  if (val === null || val === undefined) return 'NULL';
  
  if (type === 'jsonb' || type === 'json') {
    let str;
    if (typeof val === 'string') {
      try {
        JSON.parse(val);
        str = val;
      } catch (e) {
        str = JSON.stringify(val);
      }
    } else {
      str = JSON.stringify(val);
    }
    return "'" + str.replace(/'/g, "''") + "'::jsonb";
  }
  
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  
  if (type === 'ARRAY' || type?.startsWith('_') || Array.isArray(val)) {
    if (!Array.isArray(val)) {
      if (typeof val === 'string') {
        return "'" + val.replace(/'/g, "''") + "'";
      }
      return 'NULL';
    }
    const escapedElems = val.map(elem => {
      if (elem === null || elem === undefined) return 'NULL';
      return "'" + String(elem).replace(/'/g, "''") + "'";
    });
    return 'ARRAY[' + escapedElems.join(', ') + ']::text[]';
  }
  
  if (typeof val === 'number') {
    return String(val);
  }
  
  // default (text, uuid, timestamp, date, time, etc.)
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function main() {
  console.log("Reading data files...");
  
  // 1. Read Schema Columns Definitions
  const columnsData = extractJsonFromUntrusted(columnsFile);
  const schemaMap = {};
  columnsData.forEach(row => {
    const tName = row.table_name;
    const cName = row.column_name;
    const dType = row.data_type;
    if (!schemaMap[tName]) {
      schemaMap[tName] = {};
    }
    schemaMap[tName][cName] = dType;
  });
  
  // 2. Read Migrations
  const migrations = extractJsonFromUntrusted(migrationsFile);
  console.log(`Loaded ${migrations.length} migrations.`);
  
  // 3. Read Auth Users
  const authUsers = JSON.parse(fs.readFileSync(authUsersFile, 'utf8'));
  console.log(`Loaded ${authUsers.length} auth users.`);
  
  // 4. Read Auth Identities
  const authIdentities = JSON.parse(fs.readFileSync(authIdentitiesFile, 'utf8'));
  console.log(`Loaded ${authIdentities.length} auth identities.`);
  
  // 5. Read Public Tables Data
  const tableDataResult = extractJsonFromUntrusted(tableDataFile);
  const publicData = tableDataResult[0].all_data;
  console.log("Loaded public tables data.");

  // We will generate 3 separate files to stay within Supabase SQL Editor size limits
  const file1Path = path.join(path.dirname(outputFile), 'migration_1_schema_auth.sql');
  const file2Path = path.join(path.dirname(outputFile), 'migration_2_data.sql');
  const file3Path = path.join(path.dirname(outputFile), 'migration_3_audit_logs.sql');

  let sql1 = [];
  let sql2 = [];
  let sql3 = [];

  // --- FILE 1: SCHEMA AND AUTHENTICATION ---
  sql1.push("-- ==============================================================");
  sql1.push("-- SisTEA Migration - Part 1: Schema & Authentication");
  sql1.push(`-- Generated on: ${new Date().toISOString()}`);
  sql1.push("-- ==============================================================");
  sql1.push("");
  sql1.push("-- 1. Enable baseline extensions");
  sql1.push('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  sql1.push('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  sql1.push("");
  sql1.push("-- 1.5. Create supabase_migrations schema and table");
  sql1.push("CREATE SCHEMA IF NOT EXISTS supabase_migrations;");
  sql1.push("");
  sql1.push("CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (");
  sql1.push("    version TEXT PRIMARY KEY,");
  sql1.push("    name TEXT NOT NULL,");
  sql1.push("    statements TEXT[] NOT NULL,");
  sql1.push("    created_by TEXT,");
  sql1.push("    idempotency_key TEXT,");
  sql1.push("    rollback TEXT[]");
  sql1.push(");");
  sql1.push("");
  sql1.push("SET session_replication_role = 'replica';");
  sql1.push("");
  sql1.push("-- 2. Executing Migrations in Chronological Order to Build Schema");
  
  migrations.forEach(m => {
    sql1.push(`-- Migration: ${m.version}_${m.name}`);
    m.statements.forEach(stmt => {
      let cleanStmt = stmt.trim();
      if (cleanStmt && !cleanStmt.endsWith(';')) {
        cleanStmt += ';';
      }
      sql1.push(cleanStmt);
    });
    if (m.version === '20260313000227') {
      sql1.push("");
      sql1.push("-- Patch: Create missing audit_logs table");
      sql1.push("CREATE TABLE IF NOT EXISTS public.audit_logs (");
      sql1.push("    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),");
      sql1.push("    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),");
      sql1.push("    user_id UUID,");
      sql1.push("    user_email TEXT,");
      sql1.push("    user_role TEXT,");
      sql1.push("    action TEXT NOT NULL,");
      sql1.push("    table_name TEXT,");
      sql1.push("    record_id TEXT,");
      sql1.push("    old_data JSONB,");
      sql1.push("    new_data JSONB,");
      sql1.push("    ip_address TEXT,");
      sql1.push("    user_agent TEXT,");
      sql1.push("    description TEXT");
      sql1.push(");");
      sql1.push("");
      sql1.push("-- Patch: Create missing competence_audit_logs table");
      sql1.push("CREATE TABLE IF NOT EXISTS public.competence_audit_logs (");
      sql1.push("    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),");
      sql1.push("    clinic_id UUID NOT NULL,");
      sql1.push("    month INTEGER NOT NULL,");
      sql1.push("    year INTEGER NOT NULL,");
      sql1.push("    action TEXT NOT NULL,");
      sql1.push("    performed_by UUID NOT NULL,");
      sql1.push("    performed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL");
      sql1.push(");");
      sql1.push("");
      sql1.push("-- Patch: Create missing system_metadata table");
      sql1.push("CREATE TABLE IF NOT EXISTS public.system_metadata (");
      sql1.push("    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),");
      sql1.push("    current_version TEXT NOT NULL,");
      sql1.push("    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL");
      sql1.push(");");
      sql1.push("");
      sql1.push("-- Patch: Add missing active column and other address/demographic columns to public.patients table");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_street TEXT;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_number TEXT;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_complement TEXT;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_neighborhood TEXT;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS ibge_code TEXT;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nationality TEXT;");
      sql1.push("ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS ethnicity TEXT;");
      sql1.push("");
      sql1.push("-- Patch: Add missing columns to clinics, procedures, and attendances");
      sql1.push("ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS orgao_emissor TEXT;");
      sql1.push("ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS bpa_type TEXT;");
      sql1.push("ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS quantity INTEGER;");
    }
    sql1.push("");
  });
  
  sql1.push("-- 3. Clean all public and auth tables of any default/seed records");
  sql1.push("TRUNCATE TABLE supabase_migrations.schema_migrations CASCADE;");
  sql1.push("TRUNCATE TABLE auth.users CASCADE;");
  sql1.push("TRUNCATE TABLE auth.identities CASCADE;");
  
  const tablesToTruncate = [
    'public.attendance_sessions',
    'public.attendances',
    'public.audit_logs',
    'public.cid',
    'public.clinic_procedure_prices',
    'public.clinics',
    'public.competence_audit_logs',
    'public.competences',
    'public.contracts',
    'public.import_batches',
    'public.import_historical_records',
    'public.patient_clinics',
    'public.patients',
    'public.procedure_cid',
    'public.procedure_service_classifications',
    'public.procedure_specialties',
    'public.procedures',
    'public.professional_clinics',
    'public.professional_specialties',
    'public.professionals',
    'public.report_requests',
    'public.service_classifications',
    'public.specialties',
    'public.system_metadata',
    'public.system_settings',
    'public.users'
  ];
  sql1.push(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} CASCADE;`);
  sql1.push("");
  
  sql1.push("-- 4. Populate migration history ledger");
  migrations.forEach(m => {
    const versionVal = escapeSqlValue(m.version, 'text');
    const nameVal = escapeSqlValue(m.name, 'text');
    const statementsVal = escapeSqlValue(m.statements, 'ARRAY');
    const createdByVal = escapeSqlValue(m.created_by || 'fernandomarculino@gmail.com', 'text');
    const idempotencyKeyVal = escapeSqlValue(m.idempotency_key, 'text');
    const rollbackVal = escapeSqlValue(m.rollback, 'ARRAY');
    
    sql1.push(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES (${versionVal}, ${nameVal}, ${statementsVal}, ${createdByVal}, ${idempotencyKeyVal}, ${rollbackVal});`);
  });
  sql1.push("");
  
  sql1.push("-- 5. Insert Auth Users");
  const authUsersFields = [
    'id', 'instance_id', 'email', 'encrypted_password', 'email_confirmed_at',
    'raw_app_meta_data', 'raw_user_meta_data', 'created_at', 'updated_at',
    'role', 'aud', 'is_super_admin', 'confirmation_token', 'email_change',
    'email_change_token_new', 'recovery_token', 'phone_change', 'phone_change_token',
    'email_change_token_current', 'reauthentication_token'
  ];
  
  authUsers.forEach(user => {
    const fields = [];
    const values = [];
    authUsersFields.forEach(field => {
      let val = user[field];
      if (['confirmation_token', 'email_change', 'email_change_token_new', 'recovery_token', 
           'phone_change', 'phone_change_token', 'email_change_token_current', 'reauthentication_token'].includes(field)) {
        if (val === null || val === undefined) val = '';
      }
      let type = 'text';
      if (field === 'id' || field === 'instance_id') type = 'uuid';
      if (field.endsWith('_at')) type = 'timestamp';
      if (field.startsWith('raw_')) type = 'jsonb';
      if (field === 'is_super_admin') type = 'boolean';
      
      fields.push(field);
      values.push(escapeSqlValue(val, type));
    });
    sql1.push(`INSERT INTO auth.users (${fields.join(', ')}) VALUES (${values.join(', ')});`);
  });
  sql1.push("");
  
  sql1.push("-- 6. Insert Auth Identities");
  const authIdentitiesFields = [
    'id', 'provider_id', 'user_id', 'identity_data', 'provider', 
    'last_sign_in_at', 'created_at', 'updated_at'
  ];
  
  authIdentities.forEach(identity => {
    const fields = [];
    const values = [];
    authIdentitiesFields.forEach(field => {
      const val = identity[field];
      let type = 'text';
      if (field === 'id' || field === 'user_id') type = 'uuid';
      if (field.endsWith('_at')) type = 'timestamp';
      if (field === 'identity_data') type = 'jsonb';
      
      fields.push(field);
      values.push(escapeSqlValue(val, type));
    });
    sql1.push(`INSERT INTO auth.identities (${fields.join(', ')}) VALUES (${values.join(', ')});`);
  });
  sql1.push("");
  sql1.push("RESET session_replication_role;");
  sql1.push("-- End of Part 1");

  // --- FILE 2: CORE BUSINESS DATA ---
  sql2.push("-- ==============================================================");
  sql2.push("-- SisTEA Migration - Part 2: Business Data");
  sql2.push(`-- Generated on: ${new Date().toISOString()}`);
  sql2.push("-- ==============================================================");
  sql2.push("");
  sql2.push("SET session_replication_role = 'replica';");
  sql2.push("");

  // --- FILE 3: AUDIT LOGS ---
  sql3.push("-- ==============================================================");
  sql3.push("-- SisTEA Migration - Part 3: Audit Logs");
  sql3.push(`-- Generated on: ${new Date().toISOString()}`);
  sql3.push("-- ==============================================================");
  sql3.push("");
  sql3.push("SET session_replication_role = 'replica';");
  sql3.push("");

  const orderedTables = [
    'clinics',
    'specialties',
    'procedures',
    'service_classifications',
    'cid',
    'contracts',
    'system_metadata',
    'system_settings',
    'import_batches',
    'professionals',
    'patients',
    'patient_clinics',
    'professional_clinics',
    'professional_specialties',
    'procedure_cid',
    'procedure_service_classifications',
    'procedure_specialties',
    'clinic_procedure_prices',
    'attendances',
    'attendance_sessions',
    'audit_logs',
    'competence_audit_logs',
    'competences',
    'import_historical_records',
    'report_requests',
    'users'
  ];
  
  orderedTables.forEach(tName => {
    const tableRows = publicData[tName] || [];
    const isAuditLogTable = (tName === 'audit_logs' || tName === 'competence_audit_logs');
    const targetSql = isAuditLogTable ? sql3 : sql2;
    
    targetSql.push(`-- Table: public.${tName} (${tableRows.length} rows)`);
    
    if (tableRows.length > 0) {
      const colTypes = schemaMap[tName];
      if (!colTypes) {
        throw new Error(`Schema definition not found for table ${tName}`);
      }
      
      tableRows.forEach(row => {
        const fields = [];
        const values = [];
        Object.keys(row).forEach(col => {
          // Skip generated columns that cannot be populated explicitly
          if (col === 'valor_total' && (tName === 'procedures' || tName === 'clinic_procedure_prices')) {
            return;
          }
          if (colTypes[col]) {
            fields.push(col);
            values.push(escapeSqlValue(row[col], colTypes[col]));
          }
        });
        targetSql.push(`INSERT INTO public.${tName} (${fields.join(', ')}) VALUES (${values.join(', ')});`);
      });
    }
    targetSql.push("");
  });
  
  sql2.push("RESET session_replication_role;");
  sql2.push("-- End of Part 2");

  sql3.push("RESET session_replication_role;");
  sql3.push("-- End of Part 3");
  
  console.log(`Writing Part 1 to ${file1Path}...`);
  fs.writeFileSync(file1Path, sql1.join('\n'), 'utf8');

  console.log(`Writing Part 2 to ${file2Path}...`);
  fs.writeFileSync(file2Path, sql2.join('\n'), 'utf8');

  console.log(`Writing Part 3 to ${file3Path}...`);
  fs.writeFileSync(file3Path, sql3.join('\n'), 'utf8');

  console.log("Consolidated SQL dumps generated successfully!");
}

main();

