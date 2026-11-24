/**
 * URL normalization and SSRF protection service
 */

// Private IP range tests
const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const IPV4_PRIVATE_10 = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const IPV4_PRIVATE_172 = /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/
const IPV4_PRIVATE_192 = /^192\.168\.\d{1,3}\.\d{1,3}$/
const IPV4_LINK_LOCAL = /^169\.254\.\d{1,3}\.\d{1,3}$/
const IPV4_CARRIER_NAT = /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/
const IPV4_BROADCAST = /^0\.0\.0\.0$/

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '[::]',
  '::',
  '[::1]',
  '::1',
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '169.254.169.254', // AWS, GCP, Azure metadata
  '100.100.100.200', // Alibaba Cloud metadata
  'fd00:ec2::254',   // AWS IPv6 metadata
])

// Allowed ports for AI API endpoints
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443', '11434', '3000'])

export interface UrlValidationResult {
  safe: boolean
  error?: string
  normalizedUrl?: string
  parsedUrl?: URL
}

/**
 * Normalizes a base URL:
 * - Trims whitespace
 * - Removes trailing slashes
 * - Resolves /v1 safely without creating /v1/v1
 */
export function normalizeBaseUrl(rawUrl: string): string {
  if (!rawUrl) return ''
  let trimmed = rawUrl.trim()

  // Remove trailing slashes
  trimmed = trimmed.replace(/\/+$/, '')

  // Remove duplicate /v1 suffix if present twice (e.g. https://api.example.com/v1/v1)
  trimmed = trimmed.replace(/\/v1\/v1$/, '/v1')

  return trimmed
}

/**
 * Validates a base URL against SSRF and security requirements:
 * 1. Must parse as valid URL
 * 2. Protocol must be HTTPS (or HTTP if allowLocalhost is set in development)
 * 3. Must not contain username or password credentials
 * 4. Must not target private IP addresses or cloud metadata endpoints
 * 5. Must only use allowed standard or known gateway ports
 */
export function validateUrlSafety(
  rawUrl: string,
  options: { allowLocalhost?: boolean; isProduction?: boolean } = {}
): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, error: 'Base URL must be a non-empty string' }
  }

  const normalized = normalizeBaseUrl(rawUrl)

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return { safe: false, error: 'Base URL is not a valid URL format' }
  }

  // 1. Protocol check
  const protocol = parsed.protocol.toLowerCase()
  if (protocol !== 'https:' && protocol !== 'http:') {
    return { safe: false, error: 'Protocol must be HTTPS (or HTTP for local testing)' }
  }

  if (options.isProduction && protocol !== 'https:') {
    return { safe: false, error: 'HTTPS is strictly required in production' }
  }

  // 2. Reject embedded user:password credentials (e.g. https://admin:secret@api.com)
  if (parsed.username || parsed.password) {
    return { safe: false, error: 'URLs with embedded username or password are strictly forbidden' }
  }

  // 3. Port check
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, error: `Port ${parsed.port} is not in the allowed list of API ports` }
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  // 4. Blocked hostnames and cloud metadata checks
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    if (options.allowLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      // Allowed for local development testing only
    } else {
      return { safe: false, error: 'Target host is a reserved or local address which is not permitted (SSRF protection)' }
    }
  }

  // 5. Check if hostname is a private / link-local IPv4
  if (
    IPV4_LOOPBACK.test(hostname) ||
    IPV4_PRIVATE_10.test(hostname) ||
    IPV4_PRIVATE_172.test(hostname) ||
    IPV4_PRIVATE_192.test(hostname) ||
    IPV4_LINK_LOCAL.test(hostname) ||
    IPV4_CARRIER_NAT.test(hostname) ||
    IPV4_BROADCAST.test(hostname)
  ) {
    if (options.allowLocalhost && IPV4_LOOPBACK.test(hostname)) {
      // Allowed for local development
    } else {
      return { safe: false, error: 'Target IP is in a private or restricted address space (SSRF protection)' }
    }
  }

  // 6. Check for internal domain patterns
  if (
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.lan')
  ) {
    return { safe: false, error: 'Internal domain names are not permitted (SSRF protection)' }
  }

  return {
    safe: true,
    normalizedUrl: normalized,
    parsedUrl: parsed,
  }
}

/**
 * Safely constructs a target endpoint by appending subpath without doubling /v1
 * E.g.:
 * baseUrl: "https://api.openai.com/v1", subpath: "models" -> "https://api.openai.com/v1/models"
 * baseUrl: "https://api.openai.com", subpath: "models" -> "https://api.openai.com/v1/models" (standardized)
 */
export function buildEndpoint(baseUrl: string, subpath: string): string {
  const cleanBase = normalizeBaseUrl(baseUrl)
  const cleanSubpath = subpath.replace(/^\/+/, '')

  // If the base URL doesn't have /v1 at the end and doesn't already have a versioned path,
  // we check if it needs /v1 or if it should be attached directly
  let baseWithVersion = cleanBase
  if (!cleanBase.endsWith('/v1') && !cleanBase.includes('/v1/')) {
    // Only append /v1 if the path doesn't already have one
    baseWithVersion = `${cleanBase}/v1`
  }

  return `${baseWithVersion}/${cleanSubpath}`
}
