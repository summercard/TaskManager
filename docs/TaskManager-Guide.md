# TaskManager Guide

## What This Tool Is For

TaskManager is a main-portal project manager for multi-project delivery.
Each project can contain multiple versions, and each version can contain:

- target document
- implementation document
- document stages
- stage-linked tasks

## Recommended Workflow

1. Create or open a project from the main portal.
2. Initialize the current version or add a new version for the next iteration.
3. Confirm the version goal and stage template.
4. When creating a manual task, first update the target document and implementation document.
5. During development, prefer the "development integration" entry:
   - the first report creates a task automatically
   - repeated reports with the same integration key update the same task
6. Link the real project folder if you want TaskManager files to be mirrored into that project.

## Files Generated In A Linked Project

When a project folder is linked, TaskManager will generate:

- `.task-manager/README.md`
- `.task-manager/<version>/TargetDocument.md`
- `.task-manager/<version>/ImplementationDocument.md`
- `.task-manager.json`

## Version Rules

- project completion equals current version completion
- tasks should belong to the current version
- tasks should map back to a document stage
- old projects should continue by adding a new version, not by creating a duplicate project

## Development Integration Rules

- use one stable integration key for one API, module, or feature
- first report creates a task when no task exists
- later reports update the same task progress and status
- the first auto-created task still requires document update notes
