import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import { usePublicSigningInfo, useSubmitSignature } from '../../hooks/useProtocolSigning';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

export default function PublicSigningPage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = usePublicSigningInfo(token || '');
  const submitSignature = useSubmitSignature(token || '');

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !signaturePadRef.current) {
      const canvas = canvasRef.current;

      const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(ratio, ratio);
        signaturePadRef.current?.clear();
      };

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
      });

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [data]);

  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) return;
    if (!signerName.trim() || !signerEmail.trim()) return;

    const signatureData = signaturePadRef.current.toDataURL('image/png');

    await submitSignature.mutateAsync({
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
      signatureData,
    });

    setSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-sm text-gray-500">Loading protocol...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const errorMessage = error instanceof Error ? error.message : 'This signing link is invalid or has expired.';
    const isAlreadySigned = errorMessage.includes('already been signed');

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">TaskProof</h1>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-4">
            {isAlreadySigned ? (
              <>
                <div className="text-green-600 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">This protocol has already been signed.</p>
              </>
            ) : (
              <>
                <div className="text-red-500 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">Invalid or expired link</p>
                <p className="text-sm text-gray-500 mt-1">{errorMessage}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">TaskProof</h1>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-4">
            <div className="text-green-600 mb-3">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Protocol Signed</h2>
            <p className="text-sm text-gray-500">
              Thank you for signing the protocol. Your signature has been recorded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">TaskProof</h1>
          <p className="text-sm text-gray-500 mt-1">Protocol Signing</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Protocol info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{data.protocolName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generated {new Date(data.generatedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* PDF download */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <a
              href={data.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              View Protocol PDF
            </a>
          </div>

          {/* Signer info */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Signature pad */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Signature
              </label>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full"
                style={{ height: '200px', touchAction: 'none' }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Draw your signature above</p>
          </div>

          {/* Submit */}
          {submitSignature.isError && (
            <p className="text-sm text-red-600">
              {submitSignature.error instanceof Error
                ? submitSignature.error.message
                : 'Failed to submit signature. Please try again.'}
            </p>
          )}
          <Button
            className="w-full"
            onClick={handleSubmit}
            loading={submitSignature.isPending}
            disabled={!signerName.trim() || !signerEmail.trim()}
          >
            Sign Protocol
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          By signing, you confirm that you have reviewed the protocol.
        </p>
      </div>
    </div>
  );
}
