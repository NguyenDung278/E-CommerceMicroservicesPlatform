# AGENTS.md

## Purpose

This repository is an e-commerce platform currently organized as a Go microservices system with a React + Vite frontend and Docker-based local orchestration.

When you work in this repo, optimize for simplicity, operational clarity, and production robustness. Do not add complexity just because the current architecture can support it.

## Core Rule

If you are asked to propose, revise, or extend the architecture or stack, you must actively challenge the default impulse toward more services, more infrastructure, more frameworks, and more moving parts.

Your job is to propose the simplest stack that is still robust for the stated requirements.

That means:

- prefer fewer deployables
- prefer fewer databases
- prefer fewer runtime dependencies
- prefer boring, well-supported tools
- prefer patterns the team can operate with low cognitive load
- prefer solutions that are easy to test locally with the existing `Makefile` and Docker workflow

## Default Architectural Bias

Unless requirements clearly demand otherwise, prefer:

- a modular monolith over additional microservices
- synchronous HTTP within a single deployable over internal network hops
- PostgreSQL as the primary source of truth
- Redis only when there is a concrete caching, session, rate-limit, or queue need
- RabbitMQ or async messaging only when there is a real reliability or decoupling requirement
- one frontend application instead of multiple frontends
- one deployment path for local development and one for production, with minimal drift

Do not recommend Kubernetes, service meshes, event-driven choreography, CQRS, or extra infrastructure by default. These should be justified explicitly, not assumed.

## How To Evaluate A Proposed Stack

For any meaningful stack recommendation, evaluate options in this order:

1. What is the simplest architecture that satisfies the stated scale, reliability, security, and team constraints?
2. What can be removed without weakening the outcome?
3. What operational burden does each added component create?
4. What failure modes are introduced by this extra component?
5. Can the same goal be achieved inside the existing Go + PostgreSQL + React foundation?

If a simpler option is rejected, explain why.

## Recommendation Standard

When making a stack recommendation, include:

- the proposed stack
- why it is the simplest robust option
- what alternatives were considered but rejected
- the specific requirement that justifies each non-trivial component
- the migration path from the current repo if the recommendation differs from the current architecture

## When To Push Back

Push back clearly when requests introduce complexity without demonstrated need, especially:

- splitting more services out of the monorepo
- adding new databases for isolated features
- introducing message brokers for flows that can be handled transactionally
- adding Kubernetes for small-team or early-stage operation
- adding multiple backend frameworks or mixed-language services without a strong reason

## Repo-Aware Guidance

This repo already includes:

- Go services
- React + Vite frontend
- Docker Compose local environment
- PostgreSQL
- Redis
- RabbitMQ
- Prometheus, Grafana, and Jaeger

Treat these as existing constraints, not mandatory endorsements for future design. If asked what should be built next or how to simplify, you may recommend consolidating around fewer components when justified.

## Execution Guidance

When requirements are ambiguous and the ambiguity materially affects architecture, ask concise clarifying questions before recommending a stack.

When requirements are clear enough, proceed and make the recommendation directly. Favor decisive, well-reasoned guidance over broad option lists.
