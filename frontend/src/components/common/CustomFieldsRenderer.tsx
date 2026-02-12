import type { CustomFieldDefinition } from '../../types';
import Input from '../ui/Input';

interface CustomFieldsRendererProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export default function CustomFieldsRenderer({ definitions, values, onChange, errors }: CustomFieldsRendererProps) {
  if (definitions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 border-t pt-4">Custom Fields</h4>
      {definitions.map((def) => (
        <FieldRenderer
          key={def.id}
          definition={def}
          value={values[def.fieldKey]}
          onChange={(val) => onChange(def.fieldKey, val)}
          error={errors?.[def.fieldKey]}
        />
      ))}
    </div>
  );
}

function FieldRenderer({
  definition,
  value,
  onChange,
  error,
}: {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const label = `${definition.label}${definition.isRequired ? ' *' : ''}`;

  switch (definition.fieldType) {
    case 'text':
      return (
        <Input
          label={label}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );

    case 'number':
      return (
        <Input
          label={label}
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          error={error}
        />
      );

    case 'date':
      return (
        <Input
          label={label}
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );

    case 'textarea':
      return (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <textarea
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500"
            rows={3}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      );

    case 'select':
      return (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select...</option>
            {(definition.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      );

    case 'checkbox':
      return (
        <div className="w-full">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="font-medium text-gray-700">{label}</span>
          </label>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      );

    default:
      return null;
  }
}
