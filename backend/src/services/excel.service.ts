import ExcelJS from 'exceljs';
import type { CustomFieldDefinitionRow } from '../models/customField.model';
import type { ProductRow } from '../models/product.model';

const FIXED_COLUMNS = [
  { header: 'Product ID', key: 'product_id', width: 20 },
  { header: 'Name', key: 'name', width: 30 },
  { header: 'Description', key: 'description', width: 40 },
  { header: 'Link', key: 'link', width: 30 },
  { header: 'Comment', key: 'comment', width: 30 },
];

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

export function generateTemplate(
  customFields: CustomFieldDefinitionRow[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  // Instructions sheet
  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 80;
  const lines = [
    'Product Import Template',
    '',
    'How to use:',
    '1. Fill in your products on the "Products" sheet',
    '2. The "Name" column is required — all other columns are optional',
    '3. Save the file as .xlsx',
    '4. Upload it using the Import button on the Products page',
    '',
    'Column descriptions:',
    '  Product ID — Your internal SKU or product identifier (max 100 characters)',
    '  Name — Product name (required, max 255 characters)',
    '  Description — Free text description',
    '  Link — External URL (e.g. manufacturer page)',
    '  Comment — Additional notes',
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

  // Products sheet
  const sheet = workbook.addWorksheet('Products');
  sheet.columns = buildColumns(customFields);
  styleHeaderRow(sheet);

  return workbook;
}

export function generateExport(
  products: ProductRow[],
  customFields: CustomFieldDefinitionRow[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.columns = buildColumns(customFields);
  styleHeaderRow(sheet);

  for (const product of products) {
    const row: Record<string, unknown> = {
      product_id: product.product_id,
      name: product.name,
      description: product.description,
      link: product.link,
      comment: product.comment,
    };
    for (const cf of customFields) {
      row[`cf_${cf.field_key}`] = product.custom_fields?.[cf.field_key] ?? null;
    }
    sheet.addRow(row);
  }

  return workbook;
}

export interface ImportedProduct {
  productId?: string;
  name: string;
  description?: string;
  link?: string;
  comment?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportError {
  row: number;
  messages: string[];
}

export async function parseImport(
  buffer: Buffer,
  customFields: CustomFieldDefinitionRow[],
): Promise<{ valid: ImportedProduct[]; errors: ImportError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  // Find the Products sheet, or fall back to the first sheet
  let sheet = workbook.getWorksheet('Products');
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

  // Build reverse map from custom field label to field_key
  const cfLabelToKey = new Map<string, CustomFieldDefinitionRow>();
  for (const cf of customFields) {
    cfLabelToKey.set(cf.label, cf);
  }

  const valid: ImportedProduct[] = [];
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

    const name = getCellValue('Name');
    if (!name) {
      rowErrors.push('Name is required');
    }

    const link = getCellValue('Link');
    if (link && link.length > 500) {
      rowErrors.push('Link must be 500 characters or fewer');
    }

    const productId = getCellValue('Product ID');
    if (productId && productId.length > 100) {
      rowErrors.push('Product ID must be 100 characters or fewer');
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
        productId: productId ?? undefined,
        name: name!,
        description: getCellValue('Description') ?? undefined,
        link: link ?? undefined,
        comment: getCellValue('Comment') ?? undefined,
        customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      });
    }
  }

  return { valid, errors };
}
