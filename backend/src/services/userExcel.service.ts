import ExcelJS from 'exceljs';
import type { CustomFieldDefinitionRow } from '../models/customField.model';
import { validatePasswordPolicy } from '../utils/password';

const FIXED_COLUMNS = [
  { header: 'First Name', key: 'first_name', width: 20 },
  { header: 'Last Name', key: 'last_name', width: 20 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Role', key: 'role', width: 20 },
  { header: 'Password', key: 'password', width: 25 },
];

const VALID_ROLES = ['org_admin', 'project_manager', 'field_user'];

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

function buildColumns(customFields: CustomFieldDefinitionRow[]): ExcelJS.Column[] {
  const columns = FIXED_COLUMNS.map((c) => ({ ...c } as Partial<ExcelJS.Column>));
  for (const cf of customFields) {
    columns.push({ header: cf.label, key: `cf_${cf.field_key}`, width: 20 });
  }
  return columns as ExcelJS.Column[];
}

function styleHeaderRow(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 24;
}

export function generateUserTemplate(
  customFields: CustomFieldDefinitionRow[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  // Instructions sheet
  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 80;
  const lines = [
    'User Import Template',
    '',
    'How to use:',
    '1. Fill in your users on the "Users" sheet',
    '2. First Name, Last Name, Email, and Role are required',
    '3. Save the file as .xlsx',
    '4. Upload it using the Import button on the Users page',
    '',
    'Column descriptions:',
    '  First Name — User\'s first name (required, max 100 characters)',
    '  Last Name — User\'s last name (required, max 100 characters)',
    '  Email — User\'s email address (required, must be unique)',
    '  Role — One of: org_admin, project_manager, field_user (required)',
    '  Password — Optional. Min 8 chars with uppercase, lowercase, number, and special character. Auto-generated if left empty.',
  ];
  for (const cf of customFields) {
    const req = cf.is_required ? ' (required)' : '';
    const opts = cf.options ? ` — Options: ${cf.options.join(', ')}` : '';
    lines.push(`  ${cf.label} — Custom field (${cf.field_type})${req}${opts}`);
  }
  lines.forEach((text, i) => {
    instructions.getCell(i + 1, 1).value = text;
    if (i === 0) {
      instructions.getCell(i + 1, 1).font = { bold: true, size: 14 };
    }
  });

  // Users sheet
  const sheet = workbook.addWorksheet('Users');
  sheet.columns = buildColumns(customFields);
  styleHeaderRow(sheet);

  return workbook;
}

export interface ImportedUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  password?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportError {
  row: number;
  messages: string[];
}

export async function parseUserImport(
  buffer: Buffer,
  customFields: CustomFieldDefinitionRow[],
): Promise<{ valid: ImportedUser[]; errors: ImportError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  // Find the Users sheet, or fall back to the first non-Instructions sheet
  let sheet = workbook.getWorksheet('Users');
  if (!sheet) {
    sheet = workbook.worksheets.find((ws) => ws.name !== 'Instructions');
  }
  if (!sheet) {
    return { valid: [], errors: [{ row: 0, messages: ['No data sheet found in workbook'] }] };
  }

  // Map header names to column indices
  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? '').trim();
    if (val) headerMap.set(val, colNumber);
  });

  // Track emails for duplicate detection within file
  const emailsSeen = new Map<string, number>(); // email -> first row number

  // Build reverse map from custom field label to definition
  const cfLabelToKey = new Map<string, CustomFieldDefinitionRow>();
  for (const cf of customFields) {
    cfLabelToKey.set(cf.label, cf);
  }

  const valid: ImportedUser[] = [];
  const errors: ImportError[] = [];

  const rowCount = sheet.rowCount;
  for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const rowErrors: string[] = [];

    // Skip completely empty rows
    let hasData = false;
    row.eachCell(() => { hasData = true; });
    if (!hasData) continue;

    const getCellValue = (headerName: string): string | null => {
      const colIndex = headerMap.get(headerName);
      if (!colIndex) return null;
      const cell = row.getCell(colIndex);
      if (cell.value === null || cell.value === undefined) return null;
      return String(cell.value).trim() || null;
    };

    const firstName = getCellValue('First Name');
    if (!firstName) {
      rowErrors.push('First Name is required');
    } else if (firstName.length > 100) {
      rowErrors.push('First Name must be 100 characters or fewer');
    }

    const lastName = getCellValue('Last Name');
    if (!lastName) {
      rowErrors.push('Last Name is required');
    } else if (lastName.length > 100) {
      rowErrors.push('Last Name must be 100 characters or fewer');
    }

    const email = getCellValue('Email');
    if (!email) {
      rowErrors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push('Email is not a valid email address');
    } else {
      const lowerEmail = email.toLowerCase();
      const firstSeen = emailsSeen.get(lowerEmail);
      if (firstSeen) {
        rowErrors.push(`Duplicate email — same as row ${firstSeen}`);
      } else {
        emailsSeen.set(lowerEmail, rowNum);
      }
    }

    const role = getCellValue('Role');
    if (!role) {
      rowErrors.push('Role is required');
    } else if (!VALID_ROLES.includes(role.toLowerCase())) {
      rowErrors.push(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const password = getCellValue('Password');
    if (password) {
      const policyError = validatePasswordPolicy(password, email || undefined);
      if (policyError) {
        rowErrors.push(policyError);
      }
    }

    // Parse custom fields
    const customFieldValues: Record<string, unknown> = {};
    for (const cf of customFields) {
      const val = getCellValue(cf.label);
      if (cf.is_required && !val) {
        rowErrors.push(`${cf.label} is required`);
      }
      if (val !== null) {
        customFieldValues[cf.field_key] = val;
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, messages: rowErrors });
    } else {
      valid.push({
        firstName: firstName!,
        lastName: lastName!,
        email: email!,
        role: role!.toLowerCase(),
        password: password || undefined,
        customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      });
    }
  }

  return { valid, errors };
}
