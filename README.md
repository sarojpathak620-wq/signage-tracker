# Hospital Signage & Field Travel Tracking System

A full-stack, mobile-first web application built for multi-branch hospital chains to audit outdoor marketing signage and manage field staff travel reimbursement claims — with full GPS verification and an auditable approval trail.

🎥 **[Watch Demo Video](https://drive.google.com/file/d/1pKXXxFK18S7dnmsCgSlDfyX3Lwy1t5ob/view?usp=sharing)**

## Problem It Solves

1. **Signage Auditing** — Hospitals install outdoor hoardings/banners across branches, but have no reliable way to confirm field staff actually visited and verified the physical condition each month ("ghost hoardings").
2. **Travel Reimbursement Transparency** — Field staff travel between sites for inspections, and claiming reimbursement manually (via email/Outlook) offers no proof of distance or route — leading to disputes and no audit trail.

This app solves both by requiring GPS-verified, timestamped camera photos at each signage, and automatically calculating travel distance from those same verified GPS points — removing manual claims entirely.

## Key Features

- **Three-tier role-based access control**
  - **Admin** — full control: manages units, areas, users, signage, and compliance settings; views all data.
  - **Unit Head** — view-and-approve only, strictly scoped to their assigned hospital unit; reviews and approves/rejects travel reimbursement claims.
  - **BD Executive** — field staff portal; registers signage, captures GPS-verified inspection photos, submits monthly travel claims.

- **GPS-Verified Field Inspections**
  - Live camera capture (rear camera only, no gallery uploads) with real-time GPS lock.
  - Automatically flags a location mismatch if the photo is captured too far from the signage's registered coordinates.
  - One update per signage per month, with a retake/delete window before the record locks.

- **Automatic Travel Distance Calculation**
  - Calculates straight-line distance (Haversine formula) between consecutive monthly GPS-stamped visits.
  - Generates a visual route map and Google Maps driving-directions link.
  - One-click monthly travel reimbursement submission, restricted to one claim per BD executive per month.

- **Approval Workflow**
  - Unit Head reviews claims with full visit history (photos, GPS, distance per leg) and approves or rejects with a mandatory comment.
  - Status (Pending / Approved / Rejected) reflects back to the BD executive in real time.

- **Audit Log Report**
  - Long-format inspection grid: one row per monthly inspection, with signage code, unit, area, address, GPS, condition, inspector, and photo.
  - Filterable by unit, area, month range, and condition.
  - One-click Excel export.

- **Automated Compliance**
  - Configurable monthly inspection deadlines.
  - Automated reminder emails to BD executives before the deadline, and escalation alerts to Unit Heads for overdue items.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS (mobile-first) |
| Database & Auth | Supabase (PostgreSQL, Row-Level Security, Auth) |
| File Storage | Supabase Storage (private bucket, signed URLs) |
| Email | Resend API |
| Reports | SheetJS (xlsx export) |
| Maps | Haversine distance calculation + Google Maps Directions links |
| Deployment | Vercel with GitHub CI/CD |

## Architecture Highlights

- **Row-Level Security (RLS)** enforced at the database level — BD executives can only read/write their own assigned signage and current-month updates; Unit Heads are scoped to their unit via policy, not just application logic.
- **Private storage with signed URLs** — inspection photos are never publicly accessible; every image is served through time-limited signed URLs.
- **Audit-safe deletion rules** — BD executives can only retake/delete their own current month's photo before it locks; older records require Admin review with a logged reason, preserving the compliance history.

## Live Demo

🔗 **[signage-tracker-three.vercel.app](https://signage-tracker-three.vercel.app)**

*(Demo credentials available on request, or watch the video walkthrough above)*

---

Built as a solo project to solve a real operational problem for a multi-branch hospital chain's business development team.
