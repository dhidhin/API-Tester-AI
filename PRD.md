# API TESTER AI
## Product Requirements Document (PRD) v1.0 & Technical Design Document (TDD) v1.0

**Product:** API Tester AI  
**Version:** 1.0.0  
**Platform:** Web Application  
**Development IDE:** Google Antigravity  
**Target:** Developers, AI enthusiasts, AI API users

---

# PART A — PRODUCT REQUIREMENTS DOCUMENT

## 1. Product Overview

API Tester AI adalah aplikasi web untuk melakukan pengujian, analisis, dan evaluasi terhadap layanan Artificial Intelligence yang menyediakan API, khususnya API dengan format OpenAI-compatible.

Pengguna dapat memasukkan Base URL, API Key, dan Model ID untuk melakukan berbagai pengujian tanpa harus membuat program sendiri.

Aplikasi bertujuan membantu developer mengetahui apakah suatu API dapat digunakan, model apa saja yang tersedia, bagaimana performanya, dan seberapa kompatibel API tersebut dengan berbagai coding tools.

## 2. Product Objectives

1. Mempermudah pengujian AI API dari berbagai provider.
2. Mengidentifikasi masalah autentikasi dan konektivitas.
3. Menemukan model yang tersedia secara otomatis.
4. Mengukur performa model.
5. Membandingkan beberapa model.
6. Menghasilkan konfigurasi untuk coding tools.
7. Menyediakan laporan hasil pengujian yang dapat diunduh.

## 3. Target Users

- Software Developers.
- AI Application Developers.
- Programmer yang menggunakan OpenCode.
- Pengguna Cline, Continue, dan Roo Code.
- Pengguna API provider gratis maupun berbayar.
- Pengguna layanan AI Gateway dan API Aggregator.

## 4. Functional Requirements

### FR-01: API Connection

Pengguna dapat memasukkan:

- Provider Name (opsional).
- Base URL (wajib).
- API Key (wajib).
- Authentication Method.
- Custom Model ID (opsional).
- Custom HTTP Headers (opsional, terbatas pada header yang diizinkan).

Authentication Method:

- Bearer Token.
- X-API-Key.
- Custom Authentication Header.

Aplikasi menyediakan tombol:
- Test Connection.
- Fetch Models.
- Clear Form.

### FR-02: Model Discovery

Aplikasi mengambil daftar model melalui endpoint `/models`.

Informasi model yang ditampilkan:
- Model ID.
- Model Name.
- Owned By (jika tersedia).
- Context Length (jika tersedia).
- Provider.
- Status ketersediaan.

Jika endpoint model discovery tidak tersedia, pengguna dapat memasukkan Model ID secara manual.

### FR-03: Chat Playground

Fitur untuk mengirim prompt ke model.

Parameter:
- Model.
- System Prompt.
- User Prompt.
- Temperature.
- Max Tokens.
- Top P.
- Frequency Penalty.
- Presence Penalty.

Hasil:
- Generated Response.
- HTTP Status.
- Response Time.
- Token Usage.
- Raw JSON Response.
- Error Information.

### FR-04: Streaming Test

Menguji apakah provider mendukung streaming menggunakan Server-Sent Events.

Informasi:
- Streaming Status.
- Time to First Token.
- Total Duration.
- Streaming Chunks.
- Final Response.
- Token Usage jika tersedia.

### FR-05: Benchmark

Pengguna dapat memilih beberapa model untuk dibandingkan.

Parameter:
- Model ID.
- Prompt yang sama untuk semua model.
- Jumlah pengulangan.
- Temperature.
- Max Tokens.

Hasil benchmark:
- Average Latency.
- Minimum Latency.
- Maximum Latency.
- Median Latency.
- TTFT.
- Tokens per Second.
- Success Rate.
- Token Usage.

Benchmark tidak boleh menjalankan pengujian paralel secara default. Gunakan pengujian berurutan agar lebih mudah dikendalikan.

### FR-06: Compatibility Checker

Menyediakan pemeriksaan kompatibilitas untuk:

1. OpenAI SDK.
2. OpenCode.
3. Continue.dev.
4. Cline.
5. Roo Code.
6. Custom OpenAI-compatible Applications.
7. Google Antigravity.

Status:
- Compatible.
- Partially Compatible.
- Unsupported.
- Not Verified.

Pemeriksaan dilakukan berdasarkan endpoint, autentikasi, format request, streaming, dan kemampuan model yang terdeteksi.

Jangan memberikan status kompatibel hanya berdasarkan keberhasilan satu endpoint.

Google Antigravity harus diberi keterangan bahwa custom OpenAI-compatible Base URL belum menjadi konfigurasi BYOK resmi pada IDE Antigravity. Jangan menghasilkan konfigurasi yang diklaim bisa langsung dipakai tanpa dukungan resmi.

### FR-07: Error Diagnostics

Menganalisis error berikut:

- 400 Bad Request.
- 401 Unauthorized.
- 403 Forbidden.
- 404 Not Found.
- 408 Request Timeout.
- 413 Payload Too Large.
- 429 Rate Limit.
- 500 Internal Server Error.
- 502 Bad Gateway.
- 503 Service Unavailable.
- 504 Gateway Timeout.
- Network Error.
- Invalid JSON.
- Unsupported Endpoint.
- Streaming Error.

Setiap error harus memiliki:
- Error Category.
- Error Message.
- Possible Cause.
- Recommended Solution.

### FR-08: Configuration Generator

Menghasilkan konfigurasi untuk:

- OpenCode.
- OpenAI SDK.
- Continue.dev.
- Cline.
- Roo Code.
- Generic REST API.

Fitur:
- Copy Configuration.
- Download Configuration.
- Pilihan JSON atau JSONC sesuai kebutuhan.
- API Key menggunakan placeholder environment variable, bukan nilai asli.

### FR-09: Reports

Laporan mencakup:
- Provider Information.
- Base URL tanpa credential.
- Model Information.
- Connection Test.
- Chat Test.
- Streaming Test.
- Benchmark.
- Compatibility.
- Diagnostics.
- Timestamp.

Format:
- JSON.
- HTML.

API Key harus selalu dihilangkan dari laporan.

### FR-10: Session Management

Tidak memerlukan registrasi dan login untuk MVP.

Data pengujian disimpan sementara dalam memori browser.

Ketika halaman direfresh, koneksi dan API Key harus diminta kembali.

Pengguna dapat menghapus semua data melalui Clear Session.

## 5. Non-Functional Requirements

- Responsive Design.
- Desktop-first layout.
- Dark Mode dan Light Mode.
- Bahasa Indonesia dan Inggris.
- Fast Loading.
- Secure API Handling.
- Modular Architecture.
- Type Safety.
- Error Handling.
- Accessibility.
- Maintainable Code.

## 6. UI/UX Requirements

Design Style: Modern Enterprise Developer Dashboard.

Color Palette:

- Primary: Navy Blue (#101827).
- Secondary: Royal Blue (#2563EB).
- Accent: Cyan (#06B6D4).
- Background Dark: (#0B1120).
- Surface Dark: (#151F32).
- Background Light: (#F5F7FB).
- Text: (#E5E7EB).

Layout:

Sidebar:
- Dashboard.
- API Playground.
- Model Explorer.
- Chat Tester.
- Benchmark.
- Compatibility.
- Diagnostics.
- Reports.
- Settings.

Topbar:
- Current Provider.
- Current Model.
- Theme Switcher.
- Language Switcher.
- Session Status.

Main Content:
- Page Title.
- Description.
- Main Workspace.
- Result Panel.

Gunakan shadcn/ui untuk komponen dasar. Gunakan Lucide Icons dan Recharts untuk visualisasi.

---

# PART B — TECHNICAL DESIGN DOCUMENT

## 7. Technology Stack

Frontend:
- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.
- Recharts.
- React Router.
- Zustand atau React Context.
- Zod.

Backend:
- Cloudflare Workers.
- TypeScript.
- Fetch API.
- Web Streams API.

Testing:
- Vitest.
- React Testing Library.
- Worker integration tests.

Deployment:
- Cloudflare Workers.
- Cloudflare Static Assets.
- Wrangler.

Tidak menggunakan database untuk MVP.

## 8. System Architecture

Browser:
React Application
  |
  | HTTPS
  v
Cloudflare Worker
  |
  | Validated outbound HTTPS
  v
External AI Provider

Semua request ke provider harus melalui Cloudflare Worker.

Frontend tidak boleh memanggil provider langsung.

## 9. Project Structure

api-tester-ai/
|
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── charts/
│   │   └── json-viewer/
│   │
│   ├── features/
│   │   ├── dashboard/
│   │   ├── connection/
│   │   ├── models/
│   │   ├── playground/
│   │   ├── streaming/
│   │   ├── benchmark/
│   │   ├── compatibility/
│   │   ├── diagnostics/
│   │   ├── config-generator/
│   │   └── reports/
│   │
│   ├── hooks/
│   ├── lib/
│   ├── stores/
│   ├── types/
│   └── styles/
│
├── worker/
│   ├── index.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── models.ts
│   │   ├── chat.ts
│   │   ├── stream.ts
│   │   └── diagnostics.ts
│   ├── services/
│   │   ├── provider-client.ts
│   │   ├── url-validator.ts
│   │   ├── error-analyzer.ts
│   │   └── benchmark.ts
│   └── middleware/
│       ├── cors.ts
│       ├── rate-limit.ts
│       └── security.ts
│
├── tests/
├── public/
├── wrangler.jsonc
├── vite.config.ts
├── package.json
└── README.md

## 10. Backend API Design

### GET /api/health

Memeriksa kesehatan backend.

### POST /api/test-connection

Memeriksa koneksi ke provider menggunakan endpoint models.

Request:

{
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "SECRET",
  "authType": "bearer"
}

### POST /api/models

Mengambil daftar model.

### POST /api/chat/completions

Mengirim request chat completion non-streaming.

### POST /api/chat/stream

Mengirim request streaming.

Response harus menggunakan Web Streams API agar data dapat diteruskan secara bertahap.

### POST /api/benchmark

Menjalankan benchmark terhadap daftar model yang diberikan.

### POST /api/diagnostics

Menganalisis informasi error tanpa meminta pengguna mengirim ulang API Key.

Semua endpoint pengujian menggunakan POST untuk menghindari credential masuk ke URL atau query string.

## 11. Provider Client

Implementasikan provider client menggunakan Fetch API agar tidak bergantung pada satu provider SDK.

Fungsi utama:

- validateBaseUrl()
- buildEndpoint()
- buildAuthHeaders()
- fetchModels()
- testConnection()
- createCompletion()
- streamCompletion()
- normalizeProviderError()

Base URL harus dinormalisasi secara aman.

Hindari penambahan path ganda seperti `/v1/v1/chat/completions`.

Hanya izinkan endpoint yang sudah ditetapkan aplikasi.

Jangan mengizinkan frontend menentukan arbitrary destination URL untuk setiap request.

## 12. Security Requirements

Security adalah prioritas utama.

1. Semua koneksi eksternal menggunakan HTTPS pada production.
2. Blokir localhost dan alamat IP private.
3. Blokir link-local dan cloud metadata endpoints.
4. Tolak URL dengan username/password.
5. Batasi custom port.
6. Validasi domain dan resolusi IP untuk mengurangi risiko SSRF.
7. Jangan menerima redirect ke alamat yang tidak tervalidasi.
8. Jangan menyimpan API Key di localStorage, IndexedDB, cookies, atau database.
9. Jangan memasukkan API Key ke console log.
10. Jangan memasukkan API Key ke exception atau telemetry.
11. Jangan menampilkan API Key dalam laporan.
12. Terapkan rate limiting.
13. Batasi ukuran request.
14. Terapkan timeout.
15. Gunakan CORS same-origin pada deployment.
16. Validasi seluruh request menggunakan Zod.
17. Batasi header tambahan agar tidak dapat memanipulasi routing atau keamanan Worker.

Custom Header hanya diaktifkan melalui allowlist.

API Key harus berada dalam memori browser dan hanya dikirim melalui HTTPS ke backend Worker untuk diteruskan kepada provider.

## 13. Performance Requirements

- UI harus tetap responsif ketika streaming.
- Streaming tidak boleh menunggu seluruh response selesai.
- Batasi jumlah benchmark.
- Jalankan benchmark berurutan secara default.
- Tampilkan progress setiap model.
- Batalkan request ketika pengguna menekan Stop.
- Hindari menyimpan raw response berukuran besar tanpa batas.

## 14. Error Handling

Semua error harus dinormalisasi menjadi format:

{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Authentication failed",
    "httpStatus": 401,
    "possibleCause": [],
    "recommendation": []
  }
}

Jangan mengembalikan API Key atau Authorization Header dalam error response.

## 15. Compatibility Logic

Compatibility checker harus menggunakan evidence-based checks.

Contoh:

- Models endpoint berhasil: Models API supported.
- Chat completion berhasil: Chat Completions supported.
- Stream berhasil: SSE streaming supported.
- OpenAI SDK request berhasil: OpenAI SDK basic compatibility verified.
- Tool calling berhasil: Tool Calling verified.
- JSON mode berhasil: Structured JSON output verified.

Fitur yang belum diuji diberi status Not Verified.

Untuk coding tools, hasilnya adalah rekomendasi berdasarkan kemampuan API dan dokumentasi integrasi masing-masing tool, bukan klaim bahwa semua fungsi tool telah diuji.

## 16. Testing Strategy

Unit Tests:
- URL validation.
- Endpoint normalization.
- Auth header generation.
- Error normalization.
- Benchmark calculations.
- Secret redaction.

Integration Tests:
- Mock provider models endpoint.
- Mock chat completion.
- Mock streaming.
- Authentication failure.
- Rate limiting.
- Timeout.
- Invalid URL.
- SSRF protection.

UI Tests:
- Connection form.
- Model discovery.
- Chat interaction.
- Streaming cancellation.
- Benchmark progress.
- Report export.

Tidak boleh menggunakan API Key sungguhan dalam automated tests.

## 17. Acceptance Criteria

Aplikasi dinyatakan siap MVP jika:

1. Pengguna dapat memasukkan Base URL dan API Key.
2. Connection test dapat dilakukan.
3. Daftar model dapat ditampilkan.
4. Model dapat dipilih secara manual.
5. Chat completion berhasil diuji.
6. Streaming berhasil diuji.
7. Benchmark minimal dua model dapat dilakukan.
8. Compatibility report dapat dibuat.
9. Error dapat dianalisis.
10. Konfigurasi OpenCode dapat dihasilkan.
11. Laporan JSON dan HTML dapat diunduh.
12. API Key tidak tersimpan permanen.
13. SSRF protection aktif.
14. Aplikasi berhasil dijalankan secara lokal.
15. Aplikasi berhasil di-deploy ke Cloudflare.

---

# PART C — DEVELOPMENT GUIDELINES

## 18. Development Phases

PHASE 1 — Foundation:
- Scaffold React + TypeScript.
- Setup Cloudflare Workers.
- Setup Tailwind dan shadcn/ui.
- Setup routing dan layout.
- Setup theme.
- Setup language.

PHASE 2 — API Connection:
- Connection form.
- URL validator.
- Worker proxy.
- Authentication methods.
- Models discovery.
- Error handling.

PHASE 3 — Testing:
- Chat Playground.
- Streaming Test.
- Latency Measurement.
- Token Usage.
- Benchmark.

PHASE 4 — Advanced:
- Compatibility Checker.
- Diagnostics.
- Configuration Generator.
- Reports.

PHASE 5 — Finalization:
- Security review.
- Unit tests.
- Integration tests.
- Responsive review.
- Performance optimization.
- Cloudflare deployment.
- Documentation.

## 19. Development Rules

- Jangan mengimplementasikan seluruh aplikasi dalam satu langkah.
- Kerjakan berdasarkan development phases.
- Setiap fase harus dapat dijalankan.
- Jangan meninggalkan placeholder pada fitur yang sudah dinyatakan selesai.
- Jangan membuat mock API seolah-olah merupakan hasil pengujian sungguhan.
- Gunakan mock provider hanya untuk automated testing dan demo yang diberi label.
- Jalankan TypeScript checks setelah setiap fase.
- Jalankan unit tests.
- Perbaiki seluruh error sebelum melanjutkan.
- Update README dan development status.
- Jangan mengubah arsitektur tanpa alasan teknis yang jelas.

## 20. Final Product Goal

Menghasilkan aplikasi API Tester AI yang benar-benar dapat digunakan untuk menguji berbagai provider AI, melakukan benchmark model, menganalisis error, dan menghasilkan konfigurasi integrasi untuk developer tools.

**Dokumen ini menjadi sumber acuan utama selama pengembangan.**