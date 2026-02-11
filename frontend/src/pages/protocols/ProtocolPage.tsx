import { useState } from 'react';
import { useProtocols, useGenerateProtocol } from '../../hooks/useProtocols';
import type { Protocol } from '../../services/protocol.api';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'verified', label: 'Verified' },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const protocolStatusBadge: Record<string, 'yellow' | 'green' | 'red'> = {
  generating: 'yellow',
  completed: 'green',
  failed: 'red',
};

interface ProtocolPageProps {
  projectId: string;
}

export default function ProtocolPage({ projectId }: ProtocolPageProps) {
  const [name, setName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const { data: protocols, isLoading } = useProtocols(projectId);
  const generateProtocol = useGenerateProtocol(projectId);

  const hasGenerating = protocols?.some((p) => p.status === 'generating');

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const filters: Record<string, string> = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterTrade.trim()) filters.trade = filterTrade.trim();
    if (filterPriority) filters.priority = filterPriority;

    try {
      await generateProtocol.mutateAsync({
        name: name.trim(),
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
      setName('');
      setFilterStatus('');
      setFilterTrade('');
      setFilterPriority('');
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="space-y-6">
      {/* Generate Protocol Form */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Generate Protocol</h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleGenerate} className="space-y-4">
            <Input
              label="Protocol Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Monthly Progress Report"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Trade"
                value={filterTrade}
                onChange={(e) => setFilterTrade(e.target.value)}
                placeholder="e.g., Electrical"
              />
              <Select
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              />
              <Select
                label="Priority"
                options={PRIORITY_FILTER_OPTIONS}
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={generateProtocol.isPending}>
                Generate
              </Button>
            </div>
            {generateProtocol.isError && (
              <p className="text-sm text-red-600">
                {generateProtocol.error?.message || 'Failed to generate protocol.'}
              </p>
            )}
          </form>
        </CardBody>
      </Card>

      {/* Protocol History */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Protocol History</h3>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : !protocols || protocols.length === 0 ? (
            <EmptyState
              title="No protocols"
              description="Generate your first protocol using the form above."
            />
          ) : (
            <div className="space-y-2">
              {hasGenerating && (
                <p className="text-sm text-yellow-600 mb-3">
                  A protocol is being generated. This may take a few moments...
                </p>
              )}
              {protocols.map((protocol) => (
                <ProtocolRow key={protocol.id} protocol={protocol} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ProtocolRow({ protocol }: { protocol: Protocol }) {
  const formattedDate = new Date(protocol.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant={protocolStatusBadge[protocol.status] || 'gray'}>
          {protocol.status}
        </Badge>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{protocol.name}</p>
          <p className="text-xs text-gray-500">{formattedDate}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        {protocol.status === 'generating' && <Spinner size="sm" />}
        {protocol.status === 'completed' && protocol.download_url && (
          <a
            href={protocol.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Download
          </a>
        )}
        {protocol.status === 'failed' && (
          <span className="text-sm text-red-500">Failed</span>
        )}
      </div>
    </div>
  );
}
