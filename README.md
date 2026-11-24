# API Tester AI

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Cloudflare-0284c7?style=for-the-badge&logo=cloudflare)](https://api-tester-ai-worker.cah2ban.workers.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-cyan.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-Edge-orange.svg)](https://workers.cloudflare.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-55%20Passed-emerald.svg)](https://vitest.dev/)

> 🚀 **Live Demo:** [https://api-tester-ai-worker.cah2ban.workers.dev/](https://api-tester-ai-worker.cah2ban.workers.dev/)

**API Tester AI** is a modern, high-performance Developer Dashboard and Edge Proxy suite engineered to validate, benchmark, and evaluate AI API providers—specifically those adhering to the OpenAI-compatible standard. Built for AI engineers, developer tools teams, and enterprises seeking to verify custom LLM endpoints, local inference gateways (vLLM, Ollama, LM Studio), and commercial API providers.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Architecture & Design Direction](#architecture--design-direction)
- [Requirements](#requirements)
- [Installation](#installation)
- [Local Development](#local-development)
- [Automated Testing](#automated-testing)
- [Cloudflare Deployment](#cloudflare-deployment)
- [Security Notes](#security-notes)
- [Coding Tools Integration](#coding-tools-integration)

---

## Project Overview

AI engineers frequently face subtle incompatibilities, unexpected rate limits, dropped streaming tokens, and security risks when integrating custom LLM providers with agentic coding environments (such as OpenCode, Continue.dev, Cline, and Roo Code). 

**API Tester AI** provides a complete in-memory verification suite that tests upstream endpoints across:
1. **Connectivity & Latency Ping** (with SSRF guard and URL normalization).
2. **Model Catalog Discovery** (with manual model override fallback).
3. **Chat Completions** (with token usage, generation metrics, and raw JSON inspection).
4. **Server-Sent Events (SSE) Streaming** (using Web Streams API with unbuffered token passthrough and TTFT tracking).
5. **Sequential Multi-Model Benchmarking** (percentiles, latency, throughput, and comparison charts).
6. **Evidence-Based Compatibility Evaluation** (determining tool-level readiness without assuming HTTP 200 guarantees compatibility).
7. **Interactive Error Diagnostics** (mapped troubleshooting for HTTP 400-504, SSRF, TLS, and network faults).
8. **Sanitized Configuration & Report Export** (JSON, standalone dark-mode HTML, and integration presets).

---

## Key Features

### 1. API Connection Engine (FR-01)
- **Base URL Normalization:** Automatically strips duplicate `/v1` paths, trailing slashes, and embedded URL credentials.
- **Authentication Flexibility:** Bearer Token, `X-API-Key`, or Custom Header methods.
- **Password Visibility Toggle:** Mask/unmask API keys with secure session storage (in-memory only).
- **Model Discovery:** Automatic parsing of standard `/v1/models` responses with manual model ID override.
- **Live Connection Diagnostics:** Color-coded status dots and millisecond latency timers.

### 2. Chat Playground (FR-03)
- **Granular Generation Controls:** Sliders for Temperature (0.0-2.0), Max Tokens (64-8192), Top-P (0.0-1.0), Frequency Penalty, and Presence Penalty.
- **Response Viewer:** Formatted response inspector, word/character counter, and one-click copy.
- **Raw JSON Viewer:** Syntax-highlighted code block for inspecting provider headers and raw payloads.
- **Normalized Token Usage:** Calculates prompt, completion, and total tokens across varying provider schemas.
- **Cancellation:** Real-time request cancellation using `AbortController`.

### 3. Streaming Engine (FR-04)
- **Zero-Buffering SSE Proxy:** Powered by Cloudflare Workers Web Streams API for immediate token streaming.
- **Resilient Client Parser:** Robust handling of fragmented chunks split across TCP/HTTP stream reader boundaries, skipped comments, and UTF-8 multi-byte characters.
- **Time to First Token (TTFT):** Millisecond-accurate measurement from request dispatch to initial token reception.
- **Total Duration & Throughput:** Displays stream duration and chunk counter in real time.

### 4. Sequential Multi-Model Benchmark (FR-05)
- **Fair Comparison:** Multi-model selector running identical prompts and generation parameters.
- **Strict Sequential Execution:** Runs sequentially per iteration (never in parallel by default) to eliminate rate-limit bursts and inaccurate latency skew.
- **Statistical Metrics:** Calculates Average Latency, Median Latency, Min/Max Latency, TTFT Average, Tokens per Second (Throughput), and Success Rate.
- **Interactive Visualizations:** Recharts bar charts comparing latency (ms) and throughput speed (tok/s), paired with a sortable data table.

### 5. Coding Tool Compatibility Checker (FR-06)
- **Evidence-Based Evaluation:** Distinguishes between `Compatible`, `Partially Compatible`, `Unsupported`, and `Not Verified` based on verified session evidence.
- **OpenCode Custom Provider Support:** Automatically outputs properly formatted JSONC configuration with `${env:AI_PROVIDER_API_KEY}`.
- **Google Antigravity Notice:** Displays an explicit advisory that Google Antigravity uses native Gemini infrastructure and does not officially support custom OpenAI-compatible BYOK endpoints in the IDE.
- **Supported Targets:** OpenAI SDK (Node.js/Python), OpenCode, Continue.dev, Cline, Roo Code, Custom OpenAI Apps.

### 6. Comprehensive Error Diagnostics (FR-07)
- **Extensive Knowledge Base:** Step-by-step root causes and recommendations for HTTP 400, 401, 403, 404, 408, 413, 415, 422, 429, 500, 502, 503, 504.
- **Specialized Diagnoses:** Mapped analysis for `SSRF_BLOCKED`, `NETWORK_ERROR`, `SSL_ERROR`, and `STREAM_DISCONNECTED`.
- **One-Click Session Import:** Automatically pulls latest failed request from Connection, Chat, or Streaming into the diagnostics analyzer.
- **History & Filtering:** Searchable diagnostics history with copy-to-clipboard functionality.

### 7. Configuration Generator & Reports (FR-08 & FR-09)
- **Config Templates:** Ready-to-use snippets for OpenCode (JSONC), OpenAI SDK (TypeScript), Continue.dev (JSON), Cline (JSON), Roo Code (JSON), and Generic REST API (cURL).
- **Mandatory Environment Placeholders:** Real secrets are never embedded in generated configurations (`${env:AI_PROVIDER_API_KEY}`).
- **Report Exports:** Single-click export of sanitized JSON and standalone HTML reports featuring all test results, benchmark tables, and advisory notices.

---

## Architecture & Design Direction

- **Visual Direction:** Modern Enterprise Developer Dashboard.
- **Color Palette:** Deep Navy (`#101827`), Surface Dark (`#151F32`), Royal Blue (`#2563EB`), Cyan Accent (`#06B6D4`), and Emerald Success (`#10B981`).
- **Responsive Layout:** Desktop collapsible sidebar (`w-60` to `w-14`) and mobile sliding drawer with overlay.
- **Internationalization:** Full English and Indonesian language switcher (`i18next`).
- **Theme Modes:** Dark, Light, and System Theme presets.

---

## Requirements

- **Node.js:** v18.0.0 or higher (v20+ recommended).
- **Package Manager:** npm v9.0.0 or higher.
- **Cloudflare Wrangler (Optional for standalone edge deploy):** v3.0.0 or higher.

---

## Installation

Clone the repository and install all dependencies:

```bash
git clone <repository-url> "API Tester AI"
cd "API Tester AI"
npm install
```

---

## Local Development

Start the development server with integrated Cloudflare Worker proxy via `@cloudflare/vite-plugin`:

```bash
npm run dev
```

The application will start on:
```text
http://localhost:5173
```

All API routes (`/api/test-connection`, `/api/models`, `/api/chat/completions`, `/api/chat/stream`, `/api/benchmark`, `/api/health`) are intercepted and executed by the edge worker simulator during local development.

---

## Automated Testing

Run the Vitest integration and unit test suite:

```bash
# Run all automated tests
npm test

# Run tests in watch mode
npx vitest

# Run TypeScript type check
npm run type-check

# Run production build
npm run build
```

### Test Suite Overview:
- `tests/connection-engine.test.ts`: 20 tests (Mock provider, 401 auth failures, invalid URLs, SSRF protection, rate limiting).
- `tests/chat-and-stream.test.ts`: 10 tests (OpenAI normalization, alternate format handling, SSE stream parsing, split chunk recovery, abort cancellation).
- `tests/benchmark-and-compatibility.test.ts`: 5 tests (Sequential execution, Zod validation, SSRF defense, OpenCode formatting).
- `tests/final-phase-verification.test.ts`: 20 tests (Base URL credential stripping, knowledge base completeness, report generation, config placeholder enforcement, clear session store).

**Total Test Coverage:** 55 passing tests (100% pass rate).

---

## Cloudflare Deployment

The application is architected for seamless deployment to **Cloudflare Workers** with Static Asset bindings.

### Build Production Artifacts:
```bash
npm run build
```
This produces:
- `dist/client/`: The compiled Single Page Application (SPA).
- `dist/api_tester_ai_worker/index.js`: The compiled Edge Worker bundle.

### Deploy to Cloudflare:
```bash
npx wrangler deploy
```

Configuration is defined in `wrangler.jsonc`:
- Worker Entrypoint: `worker/index.ts`
- Static Assets Directory: `./dist/client`
- Compatibility Date: `2024-11-12`

---

## Security Notes

1. **Zero Database / Strict In-Memory Session:**
   API keys, headers, and credentials are never stored in `localStorage`, cookies, or persistent databases. Refreshing or clearing the session completely purges secrets from browser memory.

2. **Server-Side Request Forgery (SSRF) Defense:**
   The backend proxy strictly rejects requests targeting:
   - Loopback IPs (`127.0.0.1`, `localhost`, `::1`).
   - Private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
   - Link-local and cloud metadata endpoints (`169.254.169.254`, `100.100.100.200`).
   - Internal domains (`*.internal`, `*.local`).
   - Non-standard ports (allowed: 80, 443, 8000, 8080, 8443, 11434).

3. **HTTPS Enforcement:**
   In production environments, unencrypted HTTP Base URLs are rejected to protect API credentials in transit.

4. **Credential Redaction:**
   All outgoing error logs, diagnostic records, and report exports pass through an automatic redaction filter that strips Bearer tokens, passwords in URLs, and standard API key patterns.

5. **Edge Rate Limiting:**
   A sliding-window rate limiter on Cloudflare Workers restricts incoming client requests to 60 req/min per IP to prevent proxy abuse.

---

## Coding Tools Integration

When exporting configurations from **API Tester AI**:
- **OpenCode:** Copy the JSONC snippet into `~/.config/opencode/config.jsonc`.
- **Continue.dev:** Insert the model JSON into `~/.continue/config.json` under `models`.
- **Cline:** Add the configuration block into VS Code `settings.json`.
- **Roo Code:** Add the configuration block into VS Code `settings.json`.
- **OpenAI SDK:** Set the `AI_PROVIDER_API_KEY` environment variable in your `.env` and initialize the SDK with `baseURL`.

*Always assign your real secret key to the appropriate environment variable in your execution shell.*

---

## License

MIT License. Designed and engineered for developer productivity and enterprise AI validation.
