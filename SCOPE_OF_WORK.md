# SCOPE OF WORK (SOW)

**Project Name:** Agos Retail POS & Inventory Suite  
**Client:** v4peavenue@gmail.com (Vape Avenue)  
**Developer:** AI Coding Assistant & System Architect  
**Effective Date:** July 3, 2026  

---

## 1. PROJECT OVERVIEW
The **Agos Retail POS & Inventory Suite** is a full-stack, enterprise-grade cloud-hosted software system designed specifically to streamline multi-branch retail registers, track accurate real-time inventory, partition role-based staff visibility, implement multi-tier pricing architectures, and calculate precise financial ledgers (including tax distributions).

This document outlines the operational boundaries, milestones, and technical specifications delivered as part of the system development.

---

## 2. FUNCTIONAL SPECIFICATIONS & SCOPE DELIVERABLES

### Milestone 1: Authentication & Dynamic Location-Based Profiles
*   **Secure Cloud Authentication:** Direct Firebase Auth integration with secure user login, state monitoring, and dynamic profile redirection.
*   **Role-Based Security Tiers:** Distinct system behaviors for `Admin` vs. `Staff` (Cashier) profiles.
*   **Branch/Location Assignment:** Every user profile is assigned a specific active branch/location (e.g., Main Branch, Warehouse, North Branch).

### Milestone 2: Multi-Tier Catalog & Branch Inventory Control
*   **Multi-Branch Stocks Tracking:** Multi-variable inventory quantities associated with unique branches.
*   **Admin & Staff Stock Views:** Access to standard catalog records and inventory items to facilitate store transactions.
*   **Multi-Tier Pricing:** Independent pricing metrics configurable per product (e.g., Standard Retail, VIP Member Price, Employee Price, Wholesale Tier).
*   **Dynamic Low-Stock Alert Thresholds:** Customizable warning levels per location to highlight products nearing depletion.

### Milestone 3: POS Register System & Checkout Flow
*   **Visual Grid Catalog:** Displays product cards styled with live pricing and categorical tags inside the register panel.
*   **Dynamic Pricing Engine:** Cart updates price-level calculations instantly based on the selected customer account tier.
*   **Barcode & SKU Indexing:** Integrated fast-filter fields supporting keyboard enter-submission for physical scan triggers.
*   **Financial Checkout Calculations:** Real-time summary detailing Gross Totals, **12% VAT calculations**, custom discounts, and dual-ledger split payment capabilities (Cash, Card, E-Wallet, Split).

### Milestone 4: General Ledger & Business Intelligence
*   **Income & Expense Tracking:** Direct ledger inputs to account for operations overhead, payroll, supply acquisitions, and rental lines.
*   **Live Analytics Matrix:** High-performance data charts indicating profit margins, daily revenue metrics, and branch-specific performance reports.
*   **Real-time Audit Logs:** Immutable database registers logging user actions (e.g., cashouts, profile creation, stock adjustments, sales completions) to deter internal shrinkage.

---

## 3. TECH STACK & ARCHITECTURE

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 18+ & TypeScript | Strictly typed component layouts, high performance. |
| **Development Engine**| Vite | Modern asset bundle pipeline. |
| **Styling Framework**  | Tailwind CSS | Utilitarian design tokens, responsive presets. |
| **Database & Auth**   | Firebase (Firestore & Auth) | Real-time listeners, server-less security rule structures. |
| **Data Visuals**      | Recharts & Lucide Icons | Responsive interactive SVG charts & iconography. |

---

## 4. PROJECT TIMELINE & OUTCOME VERIFICATION

| Phase | Description | Deliverables | Status |
| :---: | :--- | :--- | :---: |
| **01** | Database Schema & Core Architecture | Firestore collections design, user profile matrices. | **Completed** |
| **02** | Inventory Control & Security Filters | Role-based visibility logic, multi-branch quantities. | **Completed** |
| **03** | Register POS & Smart Views | Category/brand-grouped default list view, grid toggle. | **Completed** |
| **04** | General Ledger & Financial Reports | Audit log pipeline, tax breakdowns, live graphs. | **Completed** |
| **05** | Final Compilation & System Handover | Build verification, documentation approval. | **Completed** |

---

## 5. DEVELOPER PROTECTIONS, LICENSING, & SUPPORT AGREEMENT

### 5.1 Intellectual Property & Proprietary Rights
The Developer retains all copyright, ownership, and intellectual property (IP) rights over the custom source code, system configurations, database architectures, and graphical interface designs developed for this project. The Client (Vape Avenue) is granted a perpetual, non-exclusive, non-transferable, single-entity license to execute and utilize this software solely for their retail operations.

### 5.2 Anti-Piracy & Non-Distribution Clause
The Client is strictly prohibited from copying, duplicating, redistributing, sub-licensing, renting, leasing, selling, or transferring the source code, asset packages, or any derivative works of this application to any third-party developer, business entity, or competitor. 

### 5.3 Permanent Support & Violation Penalties
*   **Permanent Support Guarantee:** The Developer agrees to provide perpetual (lifetime) technical support for the core application (including bug fixes, minor performance optimization updates, and emergency database recovery guidance).
*   **Support Termination Policy:** **Any breach of the Non-Distribution Clause (e.g., sharing, copying, or reselling this suite to others) will result in the immediate, automatic, and irreversible termination of all permanent support agreements.** Any future technical intervention will then be billed at standard consulting hourly rates.

### 5.4 Payment Condition for Support Activation
The permanent support agreement is strictly contingent upon the full settlement of the remaining financial balance (**₱15,000.00** PHP) as documented in Invoice **INV-2026-0703**. Failure to settle the final payment suspends all technical support and development guarantees.

### 5.5 Limitation of Liability
The software is provided "as-is" without any express or implied warranties. The Developer shall not be held liable for any indirect, incidental, or consequential damages, including but not limited to loss of business revenues, retail database corruption, sales downtime, or inventory inaccuracies.

---

## 6. SYSTEM PATCH NOTES & REVISION HISTORY

To preserve the pristine definitions of the core milestones while accounting for the latest system releases, this section documents all feature improvements and security updates implemented as part of post-milestone patches.

### Patch v1.1: Multi-Mode Register POS Views
*   **Hierarchical Grouped List View (Default Layout):** Added a highly organized layout to the POS register that automatically groups all products by **Category** and **Brand**.
*   **Visual Grid Toggle:** Implemented an on-screen view-toggle control to seamlessly switch between the Grouped List layout and the traditional card-based Grid layout.
*   **Add Qty Multiplier Panel:** Integrated block quantity controls directly into the top search bar for fast bulk entry.

### Patch v1.2: Branch-Level Inventory Permissions
*   **Role-Based Security Bounds:** Enforced localized stock visibility for non-administrative profiles. Staff accounts are isolated to seeing inventory levels only at their assigned operating branch.
*   **Admin Command Deck:** Kept global multi-branch stock distribution tables restricted exclusively to authorized administrative logins.

### Patch v1.3: Employee Performance & Shift Analytics
*   **Interactive Analytics Dashboard:** Deployed a dedicated "Employee Performance" dashboard view inside the manager control deck.
*   **Real-Time Data Integration:** Established active Firestore listener subscriptions over `users` and `attendance` logs.
*   **Multi-Variable Leaderboard Highlights:** Top Sales Volume, Top Revenue Generator, Most Hours Worked, and Sales Efficiency.
*   **Staff Performance Ledger:** Structured a responsive data table with instant search and role filtering.

### Patch v1.4: Delivery Fees & Tappable Presets
*   **Cumulative Presets:** Enabled POS quick bill buttons (+50, +100, +500, +1000) to accumulate on consecutive taps.
*   **Standardized Delivery Defaults:** Added default delivery fee of ₱50 for Online orders, with In-Store defaulted to zero.

### Patch v1.5: Unified Financial Ledger & Net Flows
*   **Unified Ledger Tab:** Introduced a comprehensive 'Unified Ledger' tab in Sales & Returns History displaying all inflows and outflows (Sales, Returns, Voids, Expenses, Transfers).
*   **Balance Sheet KPI:** Real-time summaries showing Total Cash In, Total Cash Out, and Net Cash Impact.

### Patch v1.6: Account Control & Logistical Categories
*   **Account Status Control:** Admins can activate or deactivate financial accounts directly in Finance to control POS availability.
*   **Delivery & Shipping Category:** Added "Delivery/Shipping Fee" as a standard category in Expense logs.

### Patch v1.7: Editable Checkout, Range Schedules, & Admin Controls
*   **Editable Checkout Totals:** Staff can override checkout totals with pending supervisor approval queues.
*   **Range Schedules:** Staff schedule change requests now support date ranges with automated calendar plotting.
*   **Admin-Restricted Expense Deletion:** Protected expense history with automatic ledger reversal safeguards.

### Patch v1.8: Customer Search & Saturday–Friday Weekly Cycle
*   **Customer Search in Sales History:** Direct customer name query filter across Sales, Returns, and Receivables.
*   **Saturday–Friday Weekly Cycle:** Formatted weekly reporting periods to align with Friday cutoffs and Saturday roll-overs.

### Patch v1.9: POS Customer Autocomplete & Staff Directory Access
*   **POS Customer Autocomplete:** Real-time suggestion dropdown with phone/email search and barcode loyalty card scan integration.
*   **Staff Directory Access:** Staff members can view customer directories and register new loyalty members.
*   **Manager Void Permissions:** Store managers can void sales, returns, and purchase orders.

### Patch v2.0: On-Demand Query Guardrail, Payment Label Resolution & Memory Engine
*   **Zero-Cost On-Demand Analytics:** Reports and Dashboards start blank on initial mount to protect against unintended Firestore read costs. Data is fetched only when requested via the Date Range Guardrail.
*   **Payment Option Name Resolution:** Sales & Void History payment dropdown filters now display human-readable method and account names rather than database IDs.
*   **In-Memory Firestore Cache & Multi-Tab Stability:** Switched to `memoryLocalCache` with auto-recovery listeners, resolving multi-tab IndexedDB storage corruption.
*   **Vape Avenue Atmospheric Brand Theme:** Added rich emerald green vapor aesthetic and polished styling across Login, Layout, and Home overview screens.

### Patch v2.1: Multi-Item Branch Transfers, Standardized Wide Modal Forms & Flavor Profile Migration
*   **Multi-Item Branch Stock Transfers:** Revamped Branch Stock Transfers to support transferring multiple catalog items in a single manifest, matching the purchase order architecture with dynamic item lines, real-time origin stock balance validation, and automated inventory sync.
*   **Standardized Wide-Screen Forms:** Standardized all application modal dialogs (Create Purchase Order, Stock Transfers, Product Management, and Stock Adjustments) with ultra-wide, non-cramped layouts (`sm:max-w-4xl lg:max-w-5xl`) to eliminate horizontal and vertical panel scroll fatigue.
*   **Directory Brand to Flavor Migration:** Renamed "Brand" to "Flavor" in Directory management, product definitions, catalog filters, and reporting views to natively match vape industry terminology (e.g., Mint, Lush Ice, Tobacco).

---

## 7. REVISION AND SIGN-OFF

The specifications mapped inside this Scope of Work represent the finalized, compiled, and tested system deliverables. No further features will be introduced beyond these defined functional parameters without a formal change order.

**Signed by Authorized Representatives:**

__________________________________  
**Client: Vape Avenue Representative**  
Date: ________________________  

__________________________________  
**Lead System Architect**  
Date: July 3, 2026  
