import type { AppError } from '../types'

/**
 * Secret redaction & comprehensive error analysis service
 */

/**
 * Redacts known sensitive strings (API keys, tokens) from text.
 */
export function redactSecrets(text: string, secrets: (string | undefined)[] = []): string {
  if (!text) return ''

  let result = text

  // 1. Redact explicit secrets
  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(escaped, 'gi'), '[REDACTED_API_KEY]')
    }
  }

  // 2. Redact patterns like Bearer tokens and standard key prefixes
  result = result.replace(/Bearer\s+([a-zA-Z0-9_\-\.]{8,})/gi, 'Bearer [REDACTED]')
  result = result.replace(/sk-[a-zA-Z0-9_\-]{16,}/gi, 'sk-[REDACTED]')
  result = result.replace(/x-api-key:\s*([^\s,;]+)/gi, 'x-api-key: [REDACTED]')

  return result
}

/**
 * Normalizes HTTP status code and error body into standard AppError
 */
export function normalizeProviderError(
  status: number,
  rawBody: string,
  secrets: (string | undefined)[] = []
): AppError {
  const sanitizedBody = redactSecrets(rawBody, secrets)
  let parsedMessage = ''
  let parsedCode = ''

  try {
    const json = JSON.parse(sanitizedBody)
    if (json.error) {
      if (typeof json.error === 'string') {
        parsedMessage = json.error
      } else if (typeof json.error === 'object') {
        parsedMessage = json.error.message || json.error.msg || ''
        parsedCode = json.error.code || json.error.type || ''
      }
    } else if (json.message) {
      parsedMessage = json.message
    }
  } catch {
    // raw body is not JSON, use sanitized plain text
    parsedMessage = sanitizedBody.slice(0, 300)
  }

  switch (status) {
    case 400:
      return {
        code: 'BAD_REQUEST',
        category: 'Request Error',
        message: parsedMessage || 'Bad Request: The provider rejected the request format or parameters.',
        httpStatus: 400,
        possibleCauses: [
          'The provider does not support the requested parameter.',
          'Request payload was malformed or unsupported by this model.',
          'Missing mandatory parameter in the request.',
        ],
        recommendations: [
          'Verify the Base URL and endpoint specification for this provider.',
          'Check that model parameters (temperature, max_tokens) are within valid bounds.',
        ],
      }

    case 401:
      return {
        code: 'AUTHENTICATION_FAILED',
        category: 'Authentication Error',
        message: parsedMessage || 'Authentication Failed: Invalid or missing API Key.',
        httpStatus: 401,
        possibleCauses: [
          'The API key is invalid, revoked, or expired.',
          'The authentication method does not match what the provider expects (Bearer vs X-API-Key vs Custom).',
          'Whitespace or formatting issue in the API key.',
        ],
        recommendations: [
          'Double check that the API key is active and correctly pasted without extra spaces.',
          'Verify if the provider requires "Bearer Token", "X-API-Key", or a specific custom header.',
          'Generate a new API key in your provider dashboard if needed.',
        ],
      }

    case 403:
      return {
        code: 'FORBIDDEN',
        category: 'Authorization Error',
        message: parsedMessage || 'Forbidden: Your account or API key lacks permission to access this resource.',
        httpStatus: 403,
        possibleCauses: [
          'The API key lacks permissions for the /models or chat completion endpoints.',
          'Your account has reached quota limits or requires payment/tier upgrade.',
          'The provider enforces IP restrictions or geographical geo-blocking.',
        ],
        recommendations: [
          'Check your account balance, usage quotas, and tier permissions.',
          'Verify in the provider console whether the API key has model-reading permissions.',
          'Ensure your account is active and verified.',
        ],
      }

    case 404:
      return {
        code: 'NOT_FOUND',
        category: 'Endpoint / Model Error',
        message: parsedMessage || 'Not Found: The specified endpoint or model could not be found.',
        httpStatus: 404,
        possibleCauses: [
          'The Base URL is incorrect or missing the API path version (e.g. /v1).',
          'The provider does not support the /models discovery endpoint.',
          'The requested Model ID does not exist on this provider.',
        ],
        recommendations: [
          'Confirm whether the Base URL requires "/v1" at the end (e.g. https://api.openai.com/v1).',
          'If the provider does not support /models discovery, use the "Manual Model ID" option.',
          'Check the provider documentation for the exact endpoint path.',
        ],
      }

    case 408:
      return {
        code: 'REQUEST_TIMEOUT',
        category: 'Timeout Error',
        message: parsedMessage || 'Request Timeout: The provider took too long to respond.',
        httpStatus: 408,
        possibleCauses: [
          'The provider servers are experiencing high latency.',
          'Network connectivity or intermediate gateway timed out.',
        ],
        recommendations: [
          'Retry the connection after a few moments.',
          'Check the provider system status page for ongoing outages.',
        ],
      }

    case 413:
      return {
        code: 'PAYLOAD_TOO_LARGE',
        category: 'Request Error',
        message: parsedMessage || 'Payload Too Large: The request exceeds the provider size limit.',
        httpStatus: 413,
        possibleCauses: ['The prompt or headers exceeded provider limits.'],
        recommendations: ['Reduce prompt size or headers payload.'],
      }

    case 429:
      return {
        code: 'RATE_LIMITED',
        category: 'Rate Limit Error',
        message: parsedMessage || 'Rate Limit Exceeded: Too many requests were sent in a short period.',
        httpStatus: 429,
        possibleCauses: [
          'You have exceeded the requests per minute (RPM) or tokens per minute (TPM) limit.',
          'Your account free tier limit has been exhausted.',
        ],
        recommendations: [
          'Wait 30-60 seconds before retrying.',
          'Reduce benchmark frequency or parallelism.',
          'Check your usage dashboard on the provider platform.',
        ],
      }

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        code: `SERVER_ERROR_${status}`,
        category: 'Provider Server Error',
        message: parsedMessage || `Provider Server Error (${status}): The upstream provider encountered an internal issue.`,
        httpStatus: status,
        possibleCauses: [
          'The AI provider backend or upstream gateway is experiencing an outage or maintenance.',
          'The provider model servers are overloaded.',
        ],
        recommendations: [
          'Wait a few minutes and test the connection again.',
          'Verify the provider official status page for active incidents.',
        ],
      }

    default:
      return {
        code: parsedCode || `HTTP_${status}`,
        category: 'HTTP Error',
        message: parsedMessage || `Provider returned unexpected HTTP status code ${status}`,
        httpStatus: status,
        possibleCauses: ['Unrecognized response or non-standard provider behavior.'],
        recommendations: ['Inspect the provider response details and documentation.'],
      }
  }
}
