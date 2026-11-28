---
framework_version: 1.1.2
---

# Candidate Profile

<!-- Populated 2026-11-04 from racso-career/data/career.yaml (single source of truth,
     synced with the real LinkedIn profile on 2026-10-11) and documents/cv/*.pdf.
     Fields still marked [PENDIENTE] were not confirmed by any source document and
     must be answered by racso before they are used in an application. -->

## Identity
- **Name:** Oscar Lugo
- **Location:** Remote — based in Venezuela (UTC-4). The CV states "Remote (UTC)"; the real offset is UTC-4.
- **Phone:** +58 424-109-4447 (confirmed by racso 2026-11-20; printed in the CV as `+58 424-109-4447`)
- **Email:** oscaremiliolugo@gmail.com
- **LinkedIn:** https://www.linkedin.com/in/oscar-lugo-112800210/
- **GitHub:** https://github.com/racso2609
- **Status:** Employed — Co-Founder & Technical Lead at Dlocs; currently also senior contractor on two Dlocs clients (Aurantis, Hyxora). Open to senior/lead roles.
- **Constraints:** Remote only. Timezone UTC-4 (Venezuela), which overlaps fully with US Eastern business hours and partially with EU afternoons. No relocation.

### Languages
<!-- Feeds the Language Gate in 04-job-evaluation.md. An undeclared language is a
     hard no; a declared language below the posting's requirement is flagged, not rejected. -->

| Language | Level | Notes |
|----------|-------|-------|
| Spanish | Native | |
| English | Professional working proficiency | LinkedIn profile itself is written in English; all client work and technical documentation in English |

## Education

| Degree | Period | Institution | Key Topics |
|--------|--------|-------------|------------|
| Licenciatura en Computación (B.Sc. in Computer Science) — 4 of 8 semesters completed | 2019 – (unfinished) | Universidad Central de Venezuela (UCV) | Computer science fundamentals |

<!-- No certifications are recorded in any source document. If any exist, they belong here. -->

## Professional Experience

### Senior Backend Engineer (Node.js / NestJS) - Aurantis (client of Dlocs) (2026-09 - present)
Remote
- Designed the blockchain-ingestion backend on strict hexagonal architecture: a neutral `ChainRepository` port plus per-provider adapters (Alchemy, Moralis) normalising into one canonical contract, so swapping the data provider is configuration, not code.
- Built a decorator chain over that port (rate limiting → failover → Redis cache) and real failover for streaming too, with mid-stream switching, per-subscription deduplication and per-provider fallback metrics.
- Implemented real-time streaming over WebSocket (log and ERC-20 transaction subscriptions, backpressure with async queues, bounded reconnection, cache-backed enrichment) plus a REST API documented in OpenAPI 3.1.
- Applied OWASP Top 10 practices: secure headers (helmet), input sanitisation, strict Zod validation, scoped API keys, IP allowlisting and distributed rate limiting.
- Automated quality in CI: 455+ tests (Vitest), strict TypeScript, ESLint and Prettier gated on GitHub Actions.

### Senior Frontend / Mobile Engineer - Hyxora (client of Dlocs) (2026-02 - present)
Remote
- Architected the mobile client infrastructure from zero with React Native, Expo and strict TypeScript; domain-driven design decoupled 12 feature modules and removed 30% of side-effect bugs.
- Delivered a fluid 60 FPS UI (live crypto tickers, interactive charts, balances) by optimising the render lifecycle with aggressive memoisation plus WebSocket and local cache; cut frame drops by 40%.
- Built a client-side state machine with local persistence for multi-step KYC/onboarding: zero-error state handling and 95% data recovery during abrupt network drops.
- Sole founding engineer: took the app from zero to App Store / Play Store launch (iOS + Android) in 8 months.

### Co-Founder & Technical Lead - Dlocs (2023-12 - present)
Remote
- Co-founded and scaled a software factory with 15 enterprise projects across 20 clients (DeFi, fintech, data).
- Designed a reusable architectural baseline plus automated deployment scaffolding that cut client onboarding and setup time by 40%.
- Built data pipelines (Python, MongoDB/Mongoose, PostgreSQL) migrating legacy systems into modern CRMs (Zoho) with 100% data integrity and zero downtime across 10 migrations.
- Led engineering strategy and lightweight Agile sprints, reducing delivery cycles by 25%. Main client: Hyxora (DeFi wallet).

### Senior Back End Developer - Moneva (2025-02 - 2026-02)
Part-time
- Architected a real-time activity pipeline (capturing, indexing and storing blockchain wallet events) with peaks of 5,000 events/sec across 3 chains, using Kafka as the bus between ingestion and consumers.
- Designed Kafka topics and a per-wallet-address partition key to guarantee per-account ordering, with idempotent consumers (at-least-once) and offset resets to rebuild state.
- Built secure APIs and DID-based auth flows for wallet onboarding: 25,000+ users and 99.5% login success rate.
- Modelled the PostgreSQL schema: tables range-partitioned by date with composite indexes for per-wallet history lookups, plus versioned migrations.
- Optimised microservice communication, DB indexing and multi-tier caching: −35% latency and on/off-chain state in sync within 200 ms.
- Delivered 6 microservices end-to-end with 99.9% uptime in production.

### Blockchain Developer - Parifi (2024-12 - 2025-06)
Part-time
- Built a transaction manager for massive volumes of Web3 transactions with a nonce tracker serialising concurrent submissions, eliminating nonce collisions and dropped transactions.
- Managed 500,000+ on-chain transactions with a 99.9% inclusion rate and no stuck or rejected nonces.
- Developed smart contracts and backend services for a DeFi derivatives protocol: 100,000 transactions with 25% lower gas costs.
- Shipped 12 audit-cleared smart contracts and contributed to 4 protocol releases across 3 chains; real-time on-chain data feeds at 50 ms.

### Blockchain Developer - NexeraID (2023-03 - 2024-02)
A team inside AllianceBlock (not a separate employer, not an EYSS engagement of its own)
- Self-sovereign identity issuance and verification platform: onboarding users to Web3 with self-custodial and custodial wallets.
- Worked on on-chain identity (soulbound NFTs) and compliance workflows while preserving privacy.
- JavaScript, Solidity and smart-contract stack.

### FullStack-Blockchain Developer - AllianceBlock (2022-07 - 2024-02)
Full-time
- Client engagement delivered through EYSS for the whole span; never hired directly by AllianceBlock.
- NexeraID (2023-03 - 2024-02) was a team inside AllianceBlock, so it nests here rather than standing on its own.
- Developed frontend modules and integration flows bridging institutional finance frameworks with Web3 decentralised liquidity applications.
- Implemented dApp features in JavaScript/TypeScript consumed by institutional users, integrating 8 institutional finance APIs.
- Shipped 15 end-to-end features across 5 product releases. Stack: JavaScript, Rust.

### Senior Team Lead - Leaderdao.AI (2022-12 - 2023-11)
Part-time
- Side project run inside EYSS.
- Led development of a DAO governance protocol (community voting, airdrop distribution and community-project support).
- Designed the proposal/voting flow end-to-end and led a 6-person engineering team through 12 releases.
- Mentored developers on Solidity, smart-contract testing and release discipline.

### Blockchain Developer - CUB3 (2022-05 - 2022-06)
Client project inside EYSS (2021-05 - 2024-02), not a separate employer; ended one month before AllianceBlock started
- Built web-based user experiences in React and integrated real-time data backends with Firebase.
- Shipped 10 interactive features with real-time data sync.

### Javascript FullStack Developer - EYSS (2021-05 - 2024-02)
Full-time
- Software development factory (outsourced delivery). Employed by EYSS for the whole span: AllianceBlock (2022-07 - 2024-02), CUB3 (2022-05 - 2022-06) and Leaderdao.AI (2022-12 - 2023-11) were engagements run inside it, not separate employers. The account ran to 2024-02, when Dlocs was already being founded.
- Designed scalable API routes, server logic and structured database collections using the core Node.js ecosystem.
- Implemented responsive web features and application UI elements with modern JavaScript frameworks.

### Wordpress Developer - DiplomadosOnline.com (2021-08 - 2021-08)
Part-time
- Developed custom backend plugins and data hooks for an e-learning platform.
- Automated enrollment/certification workflows, saving 30 hrs/month of manual work.

## Independent Projects

- **Agent Harness** (TypeScript, Node, pnpm monorepo, Vitest): Personal agent harness — an interaction-free SDK (`IHarness` contract, OpenAI-compatible providers, persistent sessions, tool registry with shell policy) split from a terminal client with a TUI. 41 test suites. https://github.com/racso2609/agent-harness
- **Condominio Manager** (Next.js 16, React 19, TypeScript, Supabase, PostgreSQL): Condominium management platform. Multi-tenant PostgreSQL/Supabase data model with RLS, RBAC, expense ledger and audit trail; 12 versioned SQL migrations and unit, integration and smoke test suites. https://github.com/racso2609/condominio-manager
- **Solidity Liquidity Staking** (Solidity, Hardhat, JS): Liquidity-staking stack in Solidity with a dApp to manage pools and rewards. https://github.com/racso2609/solidity-liquidity-staking
- **Racso Brain** (Next.js, TypeScript, Drizzle ORM, PostgreSQL, Vitest): Personal knowledge base — versioned data model with drizzle-kit, typed data-access layer and Vitest tests. https://github.com/racso2609/racso-brain
- **Wallet Utils** (React Router v7, TypeScript, Vite, viem): Wallet utility layer built on viem with atomic state — on-chain interactions isolated from the UI and covered by Vitest. https://github.com/racso2609/racso-wallet-utils
- **Flashloan Bot** (Solidity, JS): DeFi flash-loan bot — on-chain research/experiment. https://github.com/racso2609/flashloan-bot

### Open Source Contributions (third-party projects, not own)

- **PicoClaw** (`sipeed/picoclaw`, Go, MCP, multi-channel): Contributed to the agent and gateway — per-turn wall-clock budget, failed-turn visibility, honest state indicator, multi-channel sidebar and steering-queue state signalling.
- **ZeroClaw** (`zeroclaw-labs/zeroclaw`, Rust, IaC): Contributed improvements to the tool-call parser (normalising the DeepSeek DSML marker before parsing).

## Technical Skills

### Programming & ML
- **TypeScript / JavaScript** (expert): React, React Native (Expo), Next.js, Node.js, Express, NestJS, Fastify, TanStack, Tamagui
- **Go**: agents, gateways, MCP servers
- **Solidity**: smart contracts, DeFi protocols, Hardhat
- **Python**: data pipelines
- **SQL**, **Shell**
- **Rust** (basic)

### Domain Expertise
- Blockchain/Web3: EVM, Solana (SPL), smart contracts, DeFi, wallet and key management, DID / self-sovereign identity, cross-chain/relay
- Blockchain data providers: Alchemy, Moralis, Zerion
- Backend architecture: hexagonal (ports & adapters), microservices, Kafka event streaming, WebSocket real-time, distributed rate limiting and failover
- Databases: PostgreSQL (partitioning, composite indexes, versioned migrations), MongoDB/Mongoose, Redis
- Web3 transaction engineering: nonce management, gas optimisation

### Software & Tools
- Docker, CI/CD (GitHub Actions), Linux, systemd, MCP
- Testing: Vitest, Jest
- Validation and contracts: Zod, OpenAPI 3.1
- CRM/data migration: Zoho

<!-- Skills present in the source but NOT confirmed, so they are deliberately excluded:
     Prisma ORM, GraphQL, Azure (Functions, Service Bus, API Management, AKS, Azure DevOps),
     legacy-system integration. career.yaml lists these under `skills.pending`. -->

## Publications

None.

## Awards

[PENDIENTE] — no awards appear in any source document.

## References

[PENDIENTE] — no reference letters exist in `documents/references/` yet.

More references available upon request.

## Confirmed Profile Updates

- **2026-11-28:** Aurantis work also includes web development.
- **2026-11-28:** Moneva work also included React Native development.
- **2026-11-28:** The remaining professional engagements provide full-stack experience.
