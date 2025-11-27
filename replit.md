# Sistema de Gestão de Cobranças - TEKSAT

## Overview

This is a **fully functional and production-ready** billing management system for TEKSAT, a vehicle tracking service provider. The application automates payment notifications via WhatsApp by integrating with Asaas (payment gateway), Evolution API (WhatsApp messaging), and Traccar (GPS tracking with automatic user blocking).

**Status: ✅ FULLY OPERATIONAL** - All core features implemented and tested

Key capabilities include:
- **Automated Daily Processing** (10:00 AM America/Sao_Paulo): Fetches invoices from Asaas, categorizes by status, and sends personalized WhatsApp notifications
- **Intelligent Traccar Integration**: Automatically blocks GPS tracking for customers with 3+ overdue payments; unblocks when payments are resolved
- **Real-time Dashboard**: Key metrics (Total Pending, Due Today, Messages Sent, Blocking Status) with interactive charts
- **Comprehensive Client Management**: View mapped Traccar users, blocking status, payment status, and communication preferences
- **Full Execution History**: Detailed logs of all daily executions with success/error tracking
- **Secure Configuration**: API keys masked, Bearer Token & Session auth support for Traccar (v4.15+ and latest versions)
- **Automatic Synchronization**: Real-time sync with Asaas (fetches all statuses: PENDING, RECEIVED, CONFIRMED, OVERDUE)
- **WhatsApp Instance Management**: QR code display and instance status monitoring via Evolution API v1.8.6

The system significantly enhances TEKSAT's operational efficiency by automating collections, improving payment rates, and reducing manual effort.

## User Preferences

- Preferred communication style: Simple, everyday language
- Language: Portuguese (PT-BR)
- Timezone: America/Sao_Paulo for all scheduled tasks

## Recent Completion (Nov 27, 2025)

**Major Features Implemented & Tested:**
1. ✅ **Traccar Bearer Token Authentication** - Supports latest Traccar versions with API key authentication
2. ✅ **Automatic User Blocking** - Customers with 3+ overdue payments automatically blocked in Traccar GPS system
3. ✅ **Frontend Sync** - Client blocking status now displays correctly in "Clientes" page ("Bloqueado" column)
4. ✅ **Database Synchronization** - `is_traccar_blocked` field properly persists blocking status
5. ✅ **Execution Logs** - Detailed tracking of blocking/unblocking operations with timestamps and status

**Test Results:**
- Jose Fox identified with 4 overdue invoices → Correctly blocked in Traccar (Desativado: Sim)
- Status synced to frontend (Bloqueado column shows lock icon ✓)
- Bearer Token authentication: ✅ Working (200 response from Traccar)
- Next execution at 10:00 AM will maintain block status and auto-unblock when payments received

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite.
**UI Component Library**: Shadcn/ui (Radix UI primitives) with Tailwind CSS, following a SaaS dashboard design inspired by fintech platforms.
**Routing**: Wouter for lightweight client-side navigation.
**State Management**: TanStack Query (React Query) for server state management.
**Design System**: Custom theme with CSS variables for dark/light mode, Inter font for UI, and JetBrains Mono for data.

### Backend Architecture

**Runtime**: Node.js with Express.js.
**Language**: TypeScript with ES modules.
**API Structure**: RESTful API for configurations, webhooks (Asaas), billing, synchronization, executions, dashboard metrics, and client management.
**Storage Pattern**: PostgreSQL database with Drizzle ORM for persistent data, implementing an `IStorage` interface for abstraction. Configuration is managed via environment variables.
**Scheduled Jobs**: Node-cron for daily automated executions at 10 AM (America/Sao_Paulo).
**Service Layer Pattern**: Business logic is encapsulated in dedicated services for Asaas API, Evolution API (WhatsApp), execution orchestration, invoice processing, webhook handling, and Traccar (user blocking/unblocking).
**Key Implementations**: Includes batch processing with delays for API rate limiting, robust error handling, secret masking, and query parameter filtering.

### Data Storage Solutions

**Database**: PostgreSQL using Neon Serverless PostgreSQL with Drizzle ORM.
**Data Persistence**: Billing data, clients, executions, and logs are stored in the database.
**Session Management**: `connect-pg-simple` for PostgreSQL session storage.
**Environment Variables**: Critical configurations (database URL, API tokens for Asaas and Evolution) are managed via environment variables.

### Authentication and Authorization

A basic user schema is defined with support for password hashing, indicating planned authentication features.

## External Dependencies

### Payment Gateway
**Asaas API**: Integrates for fetching customer data, payment information, and invoice URLs.

### WhatsApp Messaging
**Evolution API**: Used for sending automated WhatsApp messages to customers, including rate limiting and phone number formatting.

### Database
**Neon Serverless PostgreSQL**: The primary database solution for persistent data storage, configured via Drizzle ORM.

### Development Tools
**N8N Workflow**: An N8N automation configuration is included in `attached_assets`, potentially used for prototyping or extended integration with Asaas.

### Infrastructure
**Replit Platform**: The application is developed and configured to run on Replit, utilizing its development environment features.