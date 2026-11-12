# DealDesk – Full Stack Developer Assignment

## Project Overview

DealDesk is a deal management application that supports user authentication, role-based permissions, deal creation, approval workflows, team communication, and invoice processing through an external BillPort API.

The project contains two applications:

- **Backend:** DealDesk API built with Node.js, Express.js, and MongoDB.
- **BillPort API:** External invoice service built with Node.js and Express.js.

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcryptjs
- Socket.IO
- Axios
- REST APIs

## Project Structure

```text
dealDesk/
├── Backend/
│   ├── src/
│   ├── seed/
│   ├── server.js
│   └── package.json
├── billport-api/
│   ├── server.js
│   └── package.json
├── .gitignore
└── README.md
```

## Setup and Installation

### Prerequisites

- Node.js
- MongoDB Atlas account or local MongoDB
- npm

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd dealDesk
```

### 2. Install DealDesk dependencies

```bash
cd Backend
npm install
```

Create a `.env` file inside the `Backend` directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
BILLPORT_URL=http://localhost:5001
BILLPORT_SECRET=your_shared_secret
```

### 3. Install BillPort dependencies

Open another terminal:

```bash
cd billport-api
npm install
```

Create a `.env` file inside the `billport-api` directory:

```env
PORT=5001
BILLPORT_SECRET=your_shared_secret
DEALDESK_WEBHOOK_URL=http://localhost:5000/api/webhooks/billport
```

Use the same `BILLPORT_SECRET` in both applications. Do not commit `.env` files.

### 4. Seed the database

From the `Backend` directory:

```bash
npm run seed
```

Seed the approval configuration:

```bash
node seed/approvalConfig.js
```

### 5. Start the applications

Start DealDesk:

```bash
npm run dev
```

Start BillPort in a separate terminal:

```bash
npm run dev
```

DealDesk runs at `http://localhost:5000`.

BillPort runs at `http://localhost:5001`.

## Demo Login Credentials

All demo users use the password:

```text
Demo@12345
```

| Role | Email |
|---|---|
| Sales Executive | alice@dealdesk.com |
| Sales Executive | bob@dealdesk.com |
| Sales Manager | charlie@dealdesk.com |
| Finance | david@dealdesk.com |
| Admin | emma@dealdesk.com |

## Main Features

### 1. Authentication and Authorization

- User login using email and password.
- Password hashing using bcryptjs.
- JWT-based authentication.
- Role-based permission checks.
- Data access scopes: own, branch, and all.

### 2. Deal Management

- Create and retrieve deals.
- Associate deals with customers and products.
- Calculate deal amounts and discounts.
- Restrict access according to user data scope.

### 3. Approval Workflow

- Approval configuration based on discount percentage.
- Automatic approval for eligible discount ranges.
- Manager and finance approval steps.
- Sequential approval and rejection handling.
- Approval history tracking.

### 4. Real-Time Communication

- Socket.IO integration.
- JWT authentication for socket connections.
- Deal-based chat rooms.
- Message persistence in MongoDB.

### 5. BillPort Invoice Integration

- Convert approved deals into invoices.
- Queue invoice processing.
- Send invoice requests to BillPort.
- HMAC-SHA256 request signature verification.
- Idempotency key support.
- Retry handling for failed invoice requests.
- Webhook signature verification.
- Event ID and sequence-based duplicate/stale event checks.
- Integration logs for tracking requests and webhook events.

## Permission and Data Scope Model

Each user is associated with a role. Roles define permissions and a data scope.

The data scopes are:

- **Own:** Users can access their own deals.
- **Branch:** Users can access deals belonging to their branch.
- **All:** Users can access all deals.

Authentication middleware verifies the JWT and loads the user's role. Permission middleware checks whether the user is allowed to perform an operation. Deal queries apply the user's data scope.

## Approval Configuration

Approval rules are stored in MongoDB and resolved by the approval service when a deal is created.

The required approval steps are determined by the deal's discount percentage. The configured workflow can require no approval, manager approval, or sequential manager, finance, and admin approvals.

## Invoice Processing and Idempotency

DealDesk creates a local invoice record with a unique deal association and an idempotency key before sending the invoice request to BillPort.

The invoice worker sends the idempotency key with each retry. BillPort uses the key to return the existing invoice instead of creating another invoice for a repeated request while its in-memory records are available.

**Limitation:** BillPort currently stores invoice and idempotency data in memory. These records are lost when BillPort restarts, so persistent exactly-once processing across restarts is not guaranteed.

## Webhook Handling

BillPort sends signed webhook events to DealDesk when invoice statuses change.

DealDesk verifies webhook signatures and checks event IDs and sequence numbers to identify duplicate or older events. Integration logs record incoming and outgoing events.

**Limitation:** Webhook processing and payment-related balance updates still need additional hardening for fully reliable asynchronous processing and exactly-once financial updates.

## Known Limitations and Future Improvements

- Persist BillPort invoices and idempotency keys in a database.
- Complete reliable asynchronous webhook processing.
- Harden payment balance updates using atomic transactions or equivalent safeguards.
- Complete and verify webhook retry and reconciliation scenarios.
- Expand automated tests and Postman coverage.
- Improve chat read tracking and notification handling.

## Submission

This repository contains the DealDesk backend and BillPort API for the Full Stack Developer assignment.
