import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useCreateSigningLink, useProtocolSignatures } from '../../hooks/useProtocolSigning';
import Badge from '../ui/Badge';

interface SendForSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  protocolId: string;
  protocolName: string;
}

export default function SendForSigningModal({
  isOpen,
  onClose,
  projectId,
  protocolId,
  protocolName: _protocolName,
}: SendForSigningModalProps) {
  const [email, setEmail] = useState('');
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'qr'>('email');

  const createLink = useCreateSigningLink(projectId, protocolId);
  const { data: signatures = [] } = useProtocolSignatures(projectId, protocolId);

  const handleSendEmail = async () => {
    if (!email.trim()) return;
    const result = await createLink.mutateAsync(email.trim());
    setSigningUrl(result.signingUrl);
    setEmail('');
  };

  const handleGenerateQr = async () => {
    const result = await createLink.mutateAsync(undefined);
    setSigningUrl(result.signingUrl);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send for Signing" size="lg">
      <div className="space-y-6">
        {/* Tab selector */}
        <div className="flex border-b border-gray-200">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'email'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('email')}
          >
            Send via Email
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'qr'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('qr')}
          >
            Show QR Code
          </button>
        </div>

        {/* Email tab */}
        {activeTab === 'email' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Enter the recipient's email address. They will receive a link to view and sign the protocol.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
              />
              <Button
                size="sm"
                onClick={handleSendEmail}
                loading={createLink.isPending}
                disabled={!email.trim()}
              >
                Send
              </Button>
            </div>
            {createLink.isSuccess && activeTab === 'email' && (
              <p className="text-sm text-green-600">Signing invitation sent successfully.</p>
            )}
          </div>
        )}

        {/* QR tab */}
        {activeTab === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Show this QR code to the person present. They can scan it to open the signing page on their device.
            </p>
            {signingUrl ? (
              <div className="flex flex-col items-center gap-3">
                <QRCodeSVG value={signingUrl} size={200} />
                <p className="text-xs text-gray-400 break-all max-w-sm text-center">{signingUrl}</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button onClick={handleGenerateQr} loading={createLink.isPending}>
                  Generate QR Code
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Existing signing links */}
        {(signatures as any[]).length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Signing Requests</h3>
            <div className="space-y-2">
              {(signatures as any[]).map((sig: any) => (
                <div
                  key={sig.id}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <div className="flex items-center gap-2">
                    {sig.signed_at ? (
                      <Badge variant="green">Signed</Badge>
                    ) : new Date(sig.expires_at) < new Date() ? (
                      <Badge variant="gray">Expired</Badge>
                    ) : (
                      <Badge variant="yellow">Pending</Badge>
                    )}
                    <span className="text-gray-700">
                      {sig.signer_name || sig.signer_email || 'Awaiting signature'}
                    </span>
                  </div>
                  {sig.signed_at && (
                    <span className="text-xs text-gray-400">
                      {new Date(sig.signed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
