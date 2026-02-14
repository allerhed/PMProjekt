import { useState, useCallback, useRef } from 'react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../../hooks/useProducts';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields';
import { useFileUpload } from '../../hooks/useFileUpload';
import { productApi } from '../../services/product.api';
import type { Product } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import CustomFieldsRenderer from '../../components/common/CustomFieldsRenderer';

const initialForm = { name: '', productId: '', description: '', link: '', comment: '' };

export default function ProductListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(initialForm);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const { data, isLoading } = useProducts({ search: search || undefined, page, limit: 50 });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const products: Product[] = data?.data?.products ?? [];
  const pagination = data?.meta?.pagination;

  function openCreate() {
    setForm(initialForm);
    setCustomFields({});
    setShowCreate(true);
  }

  function openEdit(product: Product) {
    setForm({
      name: product.name,
      productId: product.productId || '',
      description: product.description || '',
      link: product.link || '',
      comment: product.comment || '',
    });
    setCustomFields(product.customFields || {});
    setEditProduct(product);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createProduct.mutateAsync({
        name: form.name,
        productId: form.productId || undefined,
        description: form.description || undefined,
        link: form.link || undefined,
        comment: form.comment || undefined,
        ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      });
      setShowCreate(false);
      setForm(initialForm);
      setCustomFields({});
    } catch {
      // Error handled by mutation
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editProduct) return;
    try {
      await updateProduct.mutateAsync({
        id: editProduct.id,
        data: {
          name: form.name,
          productId: form.productId || null,
          description: form.description || null,
          link: form.link || null,
          comment: form.comment || null,
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        },
      });
      setEditProduct(null);
      setForm(initialForm);
      setCustomFields({});
    } catch {
      // Error handled by mutation
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
        <Button onClick={openCreate}>Add Product</Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name or product ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          description={search ? 'Try adjusting your search.' : 'Add your first product to the catalog.'}
          action={<Button onClick={openCreate}>Add Product</Button>}
        />
      ) : (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onEdit={() => openEdit(product)}
                    onDelete={() => setDeleteTarget(product)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} products)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <ProductFormModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setForm(initialForm); setCustomFields({}); }}
        title="Add Product"
        form={form}
        setForm={setForm}
        customFields={customFields}
        setCustomFields={setCustomFields}
        onSubmit={handleCreate}
        submitLabel="Create Product"
        loading={createProduct.isPending}
      />

      {/* Edit Modal */}
      <ProductFormModal
        isOpen={!!editProduct}
        onClose={() => { setEditProduct(null); setForm(initialForm); setCustomFields({}); }}
        title="Edit Product"
        form={form}
        setForm={setForm}
        customFields={customFields}
        setCustomFields={setCustomFields}
        onSubmit={handleUpdate}
        submitLabel="Save Changes"
        loading={updateProduct.isPending}
        productId={editProduct?.id}
      />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Product" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also remove it from all tasks. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteProduct.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        {product.thumbnailDownloadUrl || product.imageDownloadUrl ? (
          <img
            src={product.thumbnailDownloadUrl || product.imageDownloadUrl || ''}
            alt={product.name}
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{product.name}</div>
        {product.comment && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{product.comment}</div>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{product.productId || '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{product.description || '-'}</td>
      <td className="px-4 py-3 text-sm">
        {product.link ? (
          <a href={product.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs">
            {product.link}
          </a>
        ) : '-'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <span className="text-red-600">Delete</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ProductFormModal({
  isOpen,
  onClose,
  title,
  form,
  setForm,
  customFields,
  setCustomFields,
  onSubmit,
  submitLabel,
  loading,
  productId,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  form: typeof initialForm;
  setForm: React.Dispatch<React.SetStateAction<typeof initialForm>>;
  customFields: Record<string, unknown>;
  setCustomFields: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  submitLabel: string;
  loading: boolean;
  productId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('product');

  const { state: uploadState, progress, upload, reset: resetUpload } = useFileUpload({
    onRequestUrl: useCallback(async (file: File) => {
      if (!productId) throw new Error('Save the product first before uploading an image');
      const result = await productApi.requestImageUpload(productId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      return { uploadUrl: result.uploadUrl, resourceId: result.productId };
    }, [productId]),
    onConfirm: useCallback(async () => {
      if (!productId) return;
      await productApi.confirmImage(productId);
    }, [productId]),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File is too large. Maximum 10MB.');
      return;
    }
    upload(file);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={onSubmit}>
        <div className="space-y-4">
          <Input
            label="Product Name *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <Input
            label="Product ID"
            value={form.productId}
            onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
            helpText="Your internal product identifier (e.g., SKU)"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <Input
            label="Link"
            type="url"
            value={form.link}
            onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
            helpText="External link (e.g., manufacturer page)"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
            />
          </div>

          <CustomFieldsRenderer
            definitions={cfDefinitions}
            values={customFields}
            onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
          />

          {/* Image upload — only shown when editing (product has an ID) */}
          {productId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadState === 'uploading' || uploadState === 'confirming'}
                >
                  {uploadState === 'idle' || uploadState === 'error' ? 'Upload Image' : uploadState === 'done' ? 'Upload Another' : 'Uploading...'}
                </Button>
                {uploadState === 'uploading' && <span className="text-sm text-gray-500">{progress}%</span>}
                {uploadState === 'confirming' && <span className="text-sm text-gray-500">Processing...</span>}
                {uploadState === 'done' && <span className="text-sm text-green-600">Image uploaded</span>}
                {uploadState === 'error' && (
                  <button type="button" className="text-sm text-red-600 underline" onClick={resetUpload}>
                    Failed. Retry?
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
