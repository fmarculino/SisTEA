import crypto from 'crypto'

const HMAC_SECRET = process.env.VALIDATION_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sistea-fallback-secret-change-me'

/**
 * Generates a unique 6-digit numeric token.
 */
export function generateToken(): string {
  // Generate a cryptographically secure random 6-digit number
  const randomBytes = crypto.randomBytes(4)
  const num = randomBytes.readUInt32BE(0) % 1000000
  return String(num).padStart(6, '0')
}

/**
 * Generates an HMAC signature for a validation link.
 * Includes sessionId and timestamp to prevent tampering and replay.
 */
export function generateValidationHMAC(sessionId: string, timestamp: number): string {
  const payload = `${sessionId}:${timestamp}`
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 32)
}

/**
 * Verifies an HMAC signature for a validation link.
 */
export function verifyValidationHMAC(sessionId: string, timestamp: number, hmac: string): boolean {
  const expected = generateValidationHMAC(sessionId, timestamp)
  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))
  } catch {
    return false
  }
}

/**
 * Checks if a validation link has expired.
 * @param timestamp - The timestamp (ms) when the link was generated
 * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 */
export function isLinkExpired(timestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  return Date.now() - timestamp > maxAgeMs
}

/**
 * Builds the full validation URL for a QR Code.
 */
export function buildValidationURL(baseUrl: string, sessionId: string): string {
  const timestamp = Date.now()
  const hmac = generateValidationHMAC(sessionId, timestamp)
  return `${baseUrl}/validar/${sessionId}?h=${hmac}&t=${timestamp}`
}
