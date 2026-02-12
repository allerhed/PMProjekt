import { useState } from 'react';
import {
  useAdminCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeactivateCustomField,
  useActivateCustomField,
  useReorderCustomFields,
} from '../../hooks/useCustomFields';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import type { EntityType, FieldType, CustomFieldDefinition } from '../../types';

// ---------------------------------------------------------------------------
// Standard (built-in) field definitions per entity type
// ---------------------------------------------------------------------------

interface StandardField {
  label: string;
  fieldType: FieldType | 'email' | 'url';
  isRequired: boolean;
}

const STANDARD_FIELDS: Record<EntityType, StandardField[]> = {
  project: [
    { label: 'Project Name', fieldType: 'text', isRequired: true },
    { label: 'Description', fieldType: 'textarea', isRequired: false },
    { label: 'Address', fieldType: 'text', isRequired: false },
    { label: 'Start Date', fieldType: 'date', isRequired: false },
    { label: 'Target Completion', fieldType: 'date', isRequired: false },
  ],
  task: [
    { label: 'Title', fieldType: 'text', isRequired: true },
    { label: 'Description', fieldType: 'textarea', isRequired: false },
    { label: 'Priority', fieldType: 'select', isRequired: false },
    { label: 'Trade', fieldType: 'text', isRequired: false },
    { label: 'Contractor Email', fieldType: 'email', isRequired: false },
  ],
  product: [
    { label: 'Product Name', fieldType: 'text', isRequired: true },
    { label: 'Product ID', fieldType: 'text', isRequired: false },
    { label: 'Description', fieldType: 'textarea', isRequired: false },
    { label: 'Link', fieldType: 'url', isRequired: false },
    { label: 'Comment', fieldType: 'textarea', isRequired: false },
  ],
  user: [
    { label: 'First Name', fieldType: 'text', isRequired: true },
    { label: 'Last Name', fieldType: 'text', isRequired: true },
    { label: 'Email', fieldType: 'email', isRequired: true },
    { label: 'Role', fieldType: 'select', isRequired: true },
  ],
};

// ---------------------------------------------------------------------------
// Labels & colors
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Select',
  textarea: 'Text Area',
  checkbox: 'Checkbox',
  email: 'Email',
  url: 'URL',
};

const FIELD_TYPE_COLORS: Record<string, 'blue' | 'green' | 'yellow' | 'gray' | 'purple'> = {
  text: 'blue',
  number: 'green',
  date: 'yellow',
  select: 'purple',
  textarea: 'gray',
  checkbox: 'green',
  email: 'blue',
  url: 'blue',
};

const ENTITY_TABS: { key: EntityType; label: string }[] = [
  { key: 'project', label: 'Projects' },
  { key: 'task', label: 'Tasks' },
  { key: 'product', label: 'Products' },
  { key: 'user', label: 'Users' },
];

// ---------------------------------------------------------------------------
// FieldPreview — renders a disabled preview of the input for a given type
// ---------------------------------------------------------------------------

function FieldPreview({ fieldType, label, options }: { fieldType: string; label: string; options?: string[] }) {
  const disabledClasses =
    'block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed';

  switch (fieldType) {
    case 'textarea':
      return (
        <textarea
          className={disabledClasses + ' resize-none'}
          rows={2}
          disabled
          placeholder={`Enter ${label}...`}
        />
      );
    case 'select':
      return (
        <select className={disabledClasses} disabled>
          <option>
            {options && options.length > 0 ? options[0] : 'Select...'}
          </option>
        </select>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-not-allowed">
          <input type="checkbox" disabled className="rounded border-gray-300" />
          <span>{label}</span>
        </label>
      );
    case 'date':
      return <input type="date" className={disabledClasses} disabled />;
    case 'number':
      return <input type="number" className={disabledClasses} disabled placeholder="0" />;
    case 'email':
      return <input type="email" className={disabledClasses} disabled placeholder={`Enter ${label}...`} />;
    case 'url':
      return <input type="url" className={disabledClasses} disabled placeholder="https://..." />;
    default:
      return <input type="text" className={disabledClasses} disabled placeholder={`Enter ${label}...`} />;
  }
}

// ---------------------------------------------------------------------------
// StandardFieldCard — locked, non-editable card
// ---------------------------------------------------------------------------

function StandardFieldCard({ field }: { field: StandardField }) {
  return (
    <div className="bg-gray-50/80 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LockIcon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-700">{field.label}</span>
          <Badge variant={FIELD_TYPE_COLORS[field.fieldType] || 'gray'}>
            {FIELD_TYPE_LABELS[field.fieldType] || field.fieldType}
          </Badge>
          {field.isRequired && <Badge variant="red">Required</Badge>}
        </div>
        <span className="text-xs text-gray-400 font-medium">Built-in</span>
      </div>
      <div className="pl-6">
        <FieldPreview fieldType={field.fieldType} label={field.label} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomFieldCard — editable card with reorder / edit / deactivate
// ---------------------------------------------------------------------------

function CustomFieldCard({
  definition,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDeactivate,
}: {
  definition: CustomFieldDefinition;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none p-0.5"
              title="Move up"
            >
              &#9650;
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none p-0.5"
              title="Move down"
            >
              &#9660;
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{definition.label}</span>
              <Badge variant={FIELD_TYPE_COLORS[definition.fieldType] || 'gray'}>
                {FIELD_TYPE_LABELS[definition.fieldType]}
              </Badge>
              {definition.isRequired && <Badge variant="red">Required</Badge>}
            </div>
            <span className="text-xs text-gray-400">Key: {definition.fieldKey}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Edit
          </button>
          <button
            onClick={onDeactivate}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Deactivate
          </button>
        </div>
      </div>

      <div className="pl-9">
        <FieldPreview
          fieldType={definition.fieldType}
          label={definition.label}
          options={definition.options || undefined}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function FormBuilderPage() {
  const [activeTab, setActiveTab] = useState<EntityType>('project');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  const { data: definitions = [], isLoading } = useAdminCustomFields(activeTab);
  const deactivateField = useDeactivateCustomField();
  const activateField = useActivateCustomField();
  const reorderFields = useReorderCustomFields();

  const activeDefinitions = (definitions as CustomFieldDefinition[]).filter((d) => d.isActive);
  const inactiveDefinitions = (definitions as CustomFieldDefinition[]).filter((d) => !d.isActive);
  const standardFields = STANDARD_FIELDS[activeTab];

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const ids = activeDefinitions.map((d) => d.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderFields.mutate({ entityType: activeTab, orderedIds: ids });
  }

  function handleMoveDown(index: number) {
    if (index === activeDefinitions.length - 1) return;
    const ids = activeDefinitions.map((d) => d.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderFields.mutate({ entityType: activeTab, orderedIds: ids });
  }

  function handleDeactivate(id: string) {
    if (confirm('Are you sure you want to deactivate this field? Existing data will be preserved.')) {
      deactivateField.mutate(id);
    }
  }

  function handleActivate(id: string) {
    activateField.mutate(id);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Form Builder</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure the fields shown on <span className="font-medium">{activeTab}</span> forms
        </p>
      </div>

      {/* Entity type tabs */}
      <div className="flex gap-2 mb-8 border-b">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Standard fields section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <LockIcon className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Standard Fields
          </h2>
        </div>
        <div className="space-y-3">
          {standardFields.map((field) => (
            <StandardFieldCard key={field.label} field={field} />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-gray-300 my-8" />

      {/* Custom fields section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Custom Fields
          </h2>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            + Add Field
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {!isLoading && activeDefinitions.length === 0 && (
          <EmptyState
            title="No custom fields"
            description={`No custom fields have been defined for ${activeTab}s yet. Click "Add Field" to create one.`}
          />
        )}

        {activeDefinitions.length > 0 && (
          <div className="space-y-3">
            {activeDefinitions.map((def, index) => (
              <CustomFieldCard
                key={def.id}
                definition={def}
                index={index}
                total={activeDefinitions.length}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onEdit={() => setEditingField(def)}
                onDeactivate={() => handleDeactivate(def.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive fields section */}
      {inactiveDefinitions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            Inactive Fields ({inactiveDefinitions.length})
          </h3>
          <div className="space-y-2">
            {inactiveDefinitions.map((def) => (
              <div
                key={def.id}
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">{def.label}</span>
                  <Badge variant="gray">{FIELD_TYPE_LABELS[def.fieldType]}</Badge>
                </div>
                <button
                  onClick={() => handleActivate(def.id)}
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  Activate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <FieldFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        entityType={activeTab}
      />

      {editingField && (
        <FieldFormModal
          isOpen={true}
          onClose={() => setEditingField(null)}
          entityType={activeTab}
          editing={editingField}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldFormModal — add / edit custom field
// ---------------------------------------------------------------------------

function FieldFormModal({
  isOpen,
  onClose,
  entityType,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  editing?: CustomFieldDefinition;
}) {
  const [label, setLabel] = useState(editing?.label || '');
  const [fieldType, setFieldType] = useState<FieldType>(editing?.fieldType || 'text');
  const [isRequired, setIsRequired] = useState(editing?.isRequired || false);
  const [optionsText, setOptionsText] = useState(editing?.options?.join('\n') || '');
  const [error, setError] = useState('');

  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    if (fieldType === 'select') {
      const options = optionsText.split('\n').map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) {
        setError('Select fields need at least 2 options');
        return;
      }
    }

    const options = fieldType === 'select'
      ? optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
      : undefined;

    try {
      if (editing) {
        await updateField.mutateAsync({
          id: editing.id,
          data: { label: label.trim(), fieldType, isRequired, options },
        });
      } else {
        await createField.mutateAsync({
          entityType,
          label: label.trim(),
          fieldType,
          isRequired,
          options,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save field');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Field' : 'Add Field'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          placeholder="e.g., Contract Number"
        />

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as FieldType)}
          >
            {Object.entries(FIELD_TYPE_LABELS)
              .filter(([key]) => !['email', 'url'].includes(key))
              .map(([key, lbl]) => (
                <option key={key} value={key}>{lbl}</option>
              ))}
          </select>
        </div>

        {fieldType === 'select' && (
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Options (one per line)
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500"
              rows={4}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"Option A\nOption B\nOption C"}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
          />
          <span className="font-medium text-gray-700">Required field</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createField.isPending || updateField.isPending}>
            {editing ? 'Save Changes' : 'Add Field'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icon
// ---------------------------------------------------------------------------

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
