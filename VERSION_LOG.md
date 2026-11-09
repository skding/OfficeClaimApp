# Office Claim - Version Log

This document tracks all version releases, major enhancements, schema migrations, and template updates for the Office Claim portal.

---

## [1.0.0] - 2026-11-09

### 🚀 Highlights & Major Features
- **Bukku v2 Template Support**:
  - Upgraded export engine to support the official Bukku v2 templates (`purchase-expense-claim-template-my-v2.xlsx` and `purchase-expense-claim-template-extended-my-v2.xlsx`).
  - Correctly matches employee contact codes and legal names, reference numbers, dates in DD/MM/YYYY, account codes, and unit prices.
  - Automatic fallback mechanism that guarantees proper v2 header and column alignment.
- **Site Allowance (Payroll) Separation**:
  - Added claim classification option: **Expense Claim** vs. **Site Allowance (Payroll)**.
  - Staff and Admin can select or update whether a claim is an Expense or a Payroll Allowance.
  - Bukku export automatically filters and exports standard Expense Claims only, safely excluding Payroll Allowance claims.
- **Grouped Summary Reports & Subtotals**:
  - Employee PDF summary report now groups claims into two distinct sections:
    1. *Expense Claims*
    2. *Payroll Allowance Claims (Site Allowance)*
  - Separate subtotals are calculated and displayed for each category while maintaining the Grand Total Claim Amount.
  - Header profile banner updated with clear item counts and subtotal breakdowns.
- **Single-Page Combined Receipt Attachments**:
  - Consolidated receipt attachment metadata and document/image onto a single page (replacing the previous 2-page separator workflow).
  - High-resolution rendering with automatic aspect ratio scaling for PNG, JPG, JPEG images and multi-page/vector PDF receipts.
- **Reprint Archived Summaries**:
  - Administrators can now reprint complete PDF summary reports for archived claims directly from the Archived filter tab or from any individual claim review modal.
  - Dedicated archived report header and watermark tag to distinguish historical audits.
- **Version Badges**:
  - Displayed version 1.0.0 in both Staff and Admin navigation sidebars.

---

## [0.1.0] - 2026-06-12

### Initial MVP Release
- Core claim submission portal with Google Document AI OCR receipt scanning.
- Basic Bukku v1 XLSX export format.
- Admin review, approval, rejection, and archiving workflow.
- Individual claim report generation.
- Role-based authentication (ADMIN / STAFF).

