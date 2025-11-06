# Sistema de Gestão de Cobranças - TEKSAT

## Overview

This is a **fully functional** billing management system for TEKSAT, a vehicle tracking service provider. The application automates payment notifications via WhatsApp by integrating with Asaas (payment gateway) and Evolution API (WhatsApp messaging). 

**Status**: ✅ Complete and operational

The system runs scheduled daily executions at 10 AM (America/Sao_Paulo timezone) to:
1. Fetch customers and pending invoices from Asaas (with pagination)
2. Categorize invoices based on due dates (due today, advance warnings)
3. Send automated WhatsApp notifications with customizable message templates
4. Track execution history and message delivery status with detailed logs

Key features include:
- **Dashboard**: Real-time metrics (Total Pendente, Vence Hoje, Mensagens Enviadas, Taxa de Conversão) with interactive charts
- **Cobranças**: Comprehensive billing table with filtering by status and type
- **Relatórios**: Detailed analytics with multiple tabs (Overview, Messages, Cobranças, Executions)
- **Execuções**: Full execution history with expandable logs for each run
- **Configurações**: Secure configuration management with secret masking and validation

**Recent Changes (November 2025)**:
- Implemented complete backend with service layer architecture
- Created REST APIs for all frontend features
- Fixed critical bugs: cobrança query filtering, config secret masking
- Added input validation and error handling throughout
- Removed all mock data and connected to real backend

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**UI Component Library**: Shadcn/ui (Radix UI primitives) with Tailwind CSS for styling. The design follows a SaaS dashboard pattern inspired by fintech platforms like Asaas and Stripe, prioritizing clarity and efficient data scanning over decoration.

**Routing**: Wouter for lightweight client-side routing with the following main routes:
- `/` - Dashboard with metrics and charts
- `/cobrancas` - Billing management with filtering
- `/relatorios` - Reporting and analytics
- `/execucoes` - Execution history and logs
- `/configuracoes` - System configuration

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and automatic refetching. No complex global state library needed as most state is server-driven.

**Design System**: Custom theme using CSS variables for light/dark mode support. Typography uses Inter font for UI and JetBrains Mono for numerical/tabular data. Spacing follows Tailwind's 4px grid system (units: 4, 6, 8, 12, 16).

### Backend Architecture

**Runtime**: Node.js with Express.js server.

**Language**: TypeScript with ES modules.

**API Structure**: RESTful API with the following main endpoints:
- `GET/PUT /api/config` - Configuration management
- `GET /api/cobrancas` - Fetch invoices with filtering
- `GET/POST /api/executions` - Execution management
- `POST /api/executions/run` - Manual execution trigger
- `GET /api/dashboard/*` - Dashboard metrics and chart data

**Storage Pattern**: Currently uses in-memory storage (`MemStorage` class implementing `IStorage` interface) with support for migrating to database persistence. The storage abstraction allows easy swapping of storage backends.

**Schema Definition**: Drizzle ORM with Zod validation for type safety. Schema is defined in `shared/schema.ts` and shared between client and server.

**Scheduled Jobs**: Node-cron for daily automated executions at 10 AM Brazil time.

**Service Layer Pattern**: Business logic is separated into dedicated service classes:
- `AsaasService` (server/services/asaas.service.ts) - Handles Asaas API integration with pagination support for customers and pending payments
- `EvolutionService` (server/services/evolution.service.ts) - Manages WhatsApp messaging via Evolution API with batch sending and rate limiting
- `ExecutionService` (server/services/execution.service.ts) - Orchestrates the main execution flow: fetch data → categorize → send messages → log results
- `ProcessorService` (server/services/processor.service.ts) - Categorizes invoices (vence_hoje vs aviso) and generates personalized messages from templates

**Key Implementation Details**:
- Batch processing with delays to avoid API rate limits (1s between messages, 2s between batches)
- Proper error handling with detailed logging for each message sent
- Secret masking on GET /api/config with validation on PUT to prevent credential overwrites
- Query parameter filtering for cobranças with proper URL construction

### Data Storage Solutions

**Current Implementation**: In-memory storage using Map and array structures for rapid prototyping and development.

**Planned Migration**: PostgreSQL database configured with Drizzle ORM (configuration present in `drizzle.config.ts`). The schema includes:
- Users table (with authentication support)
- Execution history and logs
- Configuration persistence

**Session Management**: Connect-pg-simple for PostgreSQL session storage (when database is connected).

**Environment Variables**: Configuration stored in environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `ASAAS_TOKEN` - Asaas API authentication
- `ASAAS_URL` - Asaas API base URL
- `EVOLUTION_URL` - Evolution API base URL
- `EVOLUTION_INSTANCE` - WhatsApp instance name
- `EVOLUTION_APIKEY` - Evolution API key

### Authentication and Authorization

**Current State**: Basic user schema defined with username/password fields, but authentication is not yet implemented in the application flow.

**Planned Implementation**: The schema includes a users table with password hashing support, suggesting planned authentication functionality.

## External Dependencies

### Payment Gateway
**Asaas API** - Third-party payment platform integration
- Fetches customer data with pagination support (100 records per request)
- Retrieves pending payment information including invoice URLs
- Base URL: `https://api.asaas.com/v3`
- Authentication: Access token via headers

### WhatsApp Messaging
**Evolution API** - WhatsApp messaging service
- Sends text messages to customers via WhatsApp
- Formats phone numbers with Brazilian country code (+55)
- Implements rate limiting delays (1 second between messages)
- Requires instance name and API key for authentication

### Database
**Neon Serverless PostgreSQL** - Serverless PostgreSQL database (@neondatabase/serverless)
- Configured via Drizzle ORM
- Schema migrations stored in `/migrations` directory
- Not yet actively used but infrastructure is in place

### Development Tools
**N8N Workflow** - The `attached_assets` folder contains an N8N automation configuration that appears to be a reference implementation for the Asaas integration workflow, suggesting the system may have been initially prototyped or designed to work alongside N8N automation.

### Infrastructure
**Replit Platform** - The application is configured to run on Replit with specific plugins for development experience (runtime error overlay, cartographer, dev banner).