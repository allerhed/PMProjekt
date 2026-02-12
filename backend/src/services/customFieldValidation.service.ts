import * as customFieldModel from '../models/customField.model';

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitized: Record<string, unknown>;
}

export async function validateCustomFields(
  organizationId: string,
  entityType: string,
  customFields: Record<string, unknown> | undefined,
): Promise<ValidationResult> {
  const definitions = await customFieldModel.findByOrganizationAndEntity(
    organizationId,
    entityType,
  );

  if (!definitions.length) {
    return { valid: true, errors: {}, sanitized: {} };
  }

  const errors: Record<string, string> = {};
  const sanitized: Record<string, unknown> = {};
  const values = customFields || {};

  for (const def of definitions) {
    const value = values[def.field_key];
    const isEmpty = value === undefined || value === null || value === '';

    if (def.is_required && isEmpty) {
      errors[def.field_key] = `${def.label} is required`;
      continue;
    }

    if (isEmpty) continue;

    switch (def.field_type) {
      case 'text':
      case 'textarea': {
        const strVal = String(value);
        if (strVal.length > 5000) {
          errors[def.field_key] = `${def.label} must be at most 5000 characters`;
        } else {
          sanitized[def.field_key] = strVal;
        }
        break;
      }
      case 'number': {
        const numVal = Number(value);
        if (isNaN(numVal)) {
          errors[def.field_key] = `${def.label} must be a number`;
        } else {
          sanitized[def.field_key] = numVal;
        }
        break;
      }
      case 'date': {
        const dateStr = String(value);
        if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          errors[def.field_key] = `${def.label} must be a valid date`;
        } else {
          sanitized[def.field_key] = dateStr;
        }
        break;
      }
      case 'select': {
        const strVal = String(value);
        const opts = def.options || [];
        if (!opts.includes(strVal)) {
          errors[def.field_key] = `${def.label} must be one of: ${opts.join(', ')}`;
        } else {
          sanitized[def.field_key] = strVal;
        }
        break;
      }
      case 'checkbox': {
        sanitized[def.field_key] = Boolean(value);
        break;
      }
      default:
        sanitized[def.field_key] = value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}
