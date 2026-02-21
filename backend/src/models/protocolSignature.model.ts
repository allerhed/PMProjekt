import pool from '../config/database';

export interface ProtocolSignatureRow {
  id: string;
  protocol_id: string;
  token: string;
  token_hash: string;
  expires_at: Date;
  signer_name: string | null;
  signer_email: string | null;
  signature_data: string | null;
  signed_at: Date | null;
  created_at: Date;
}

export async function createSigningToken(
  protocolId: string,
  _token: string,
  tokenHash: string,
  expiresInDays: number = 7,
): Promise<ProtocolSignatureRow> {
  const result = await pool.query(
    `INSERT INTO protocol_signatures (protocol_id, token, token_hash, expires_at)
     VALUES ($1, 'redacted', $2, NOW() + make_interval(days => $3)) RETURNING *`,
    [protocolId, tokenHash, expiresInDays],
  );
  return result.rows[0];
}

export async function findByTokenHash(tokenHash: string): Promise<ProtocolSignatureRow | null> {
  const result = await pool.query(
    `SELECT * FROM protocol_signatures
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

export async function findByToken(token: string): Promise<ProtocolSignatureRow | null> {
  const result = await pool.query(
    `SELECT * FROM protocol_signatures
     WHERE token = $1 AND expires_at > NOW()`,
    [token],
  );
  return result.rows[0] || null;
}

export async function submitSignature(
  id: string,
  signerName: string,
  signerEmail: string,
  signatureData: string,
): Promise<ProtocolSignatureRow | null> {
  const result = await pool.query(
    `UPDATE protocol_signatures
     SET signer_name = $1, signer_email = $2, signature_data = $3, signed_at = NOW()
     WHERE id = $4 RETURNING *`,
    [signerName, signerEmail, signatureData, id],
  );
  return result.rows[0] || null;
}

export async function findSignaturesByProtocol(protocolId: string): Promise<ProtocolSignatureRow[]> {
  const result = await pool.query(
    `SELECT id, protocol_id, signer_name, signer_email, signed_at, created_at, expires_at
     FROM protocol_signatures
     WHERE protocol_id = $1
     ORDER BY created_at DESC`,
    [protocolId],
  );
  return result.rows;
}
