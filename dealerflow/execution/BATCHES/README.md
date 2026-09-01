# Batch Reconciliation Index

Batch documents are intake evidence, not execution authority. Record each consumed batch here or in a bounded file using its source path, classification (complete, verification, gap, deferred, superseded, or decision), survivor work-item IDs, and rationale. Do not copy entire external specifications into the repository.

The portfolio-governance and execution-operating-system batches are reconciled through `config/capability-implementation-registry.json`, `EXECUTION_QUEUE.yaml`, and `docs/operations/EXECUTION_OPERATING_SYSTEM.md`.
