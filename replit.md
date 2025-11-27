# Sistema de Gestão de Cobranças - TEKSAT

## Overview

This is a **fully functional** billing management system for TEKSAT, a vehicle tracking service provider. The application automates payment notifications via WhatsApp by integrating with Asaas (payment gateway) and Evolution API (WhatsApp messaging). It aims to streamline collections, improve payment rates, and reduce manual effort for TEKSAT.

Key capabilities include:
- Automated daily processing to fetch invoices, categorize them by due date, and send personalized WhatsApp notifications.
- Real-time dashboard with key metrics (Total Pending, Due Today, Messages Sent, Conversion Rate) and interactive charts.
- Comprehensive billing tables with filtering and reporting tools for detailed analytics.
- Full execution history with detailed logs for tracking system operations.
- Secure configuration management with secret masking and validation.
- Automatic synchronization with Asaas, including detection and removal of deleted invoices.
- Automated WhatsApp instance management, including QR code display for easy connection.

The system significantly enhances TEKSAT's operational efficiency in managing customer billing and communication, ensuring timely payments and a better customer experience.

## User Preferences

Preferred communication style: Simple, everyday language.

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