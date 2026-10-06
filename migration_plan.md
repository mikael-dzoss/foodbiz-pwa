# 🚀 FoodBiz PWA Migration Plan

This document outlines the strategic pivot from a React Native (Expo) mobile app to a unified Progressive Web App (PWA) stack. The migration will be executed in a dedicated subdirectory to preserve the legacy codebase during the transition, moving forward via structured, phased Pull Requests.

## 🎯 1. Why We Are Migrating

- **Unified Codebase:** Serves both business managers (dashboard) and customers (shop) from a single repository, eliminating the need to maintain separate projects.
- **SEO & Discoverability:** Essential for the customer-facing storefront. Web indexability allows organic growth that a closed mobile app cannot offer.
- **Frictionless Onboarding:** Customers can view products and order instantly via a URL without navigating app stores.
- **PWA Capabilities:** The manager still gets a "native-like" experience via mobile browser installation (offline caching, home screen icon).

## 🛠️ 2. The New Stack & Advantages

- **Frontend:** **Next.js (App Router)**. Delivers Server-Side Rendering (SSR) for customer SEO, and seamless API/client routing for the manager dashboard.
- **Styling:** **Tailwind CSS + shadcn/ui**. Ensures rapid, mobile-first, and highly accessible design without vendor lock-in.
- **Backend:** **Supabase**. Provides a powerful free tier for PostgreSQL, Authentication, Storage, and Row Level Security (RLS) to safely segregate manager vs. customer data.
- **Deployment:** **Vercel**. Offers zero-config deployments, automatic SSL, and dedicated staging URLs for every Pull Request.

---

## 📅 3. Phased Migration Plan

To maintain quality and track progress, the migration will be executed in distinct phases. Each phase represents a discrete Pull Request (PR).

### **Phase 1: Project Initialization**

- Create a dedicated subdirectory (e.g., `/web` or `/pwa`).
- Scaffold the Next.js project with core dependencies (Tailwind, TypeScript, Supabase client).
- Configure the `.devcontainer` specifically for the new web stack to ensure isolated, reproducible developer environments.

### **Phase 2: Documentation & Agentic Setup**

- Port and adapt existing documentation (`CONTRIBUTING.md`, `architecture.md`).
- Rewrite `AGENTS.md` and related `.agents/rules/` to enforce Next.js App Router patterns, Tailwind constraints, and React Server Components (RSC) best practices.

### **Phase 3: CI/CD Pipeline Configuration**

- Set up GitHub Actions for the new subdirectory (linting, type-checking, running Vite/Vitest).
- Configure Vercel integration for automatic staging deployments on Pull Requests.

### **Phase 4: Backlog & Roadmap Setup**

- Generate a comprehensive, Jira-style backlog.
- Define Epics and mapped User Stories aiming towards a `v0.9` milestone (a fully functional end-to-end app deployed on Vercel staging).

### **Phase 5: Design System & MCP Integration**

- Enforce integration with a design MCP server (e.g., Google Stitch or Figma).
- Validate and establish modern, coherent mobile-first UI patterns and theme tokens before writing implementation code.

### **Phase 6: Iterative Development (Towards v0.9)**

- Systematically execute the backlog.
- Each user story will be developed, tested, and merged via PR, incrementally building the application up to the `v0.9` staging release.
