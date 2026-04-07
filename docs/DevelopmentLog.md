# Development Log

## 2026-04-06

### Versioned Workspace

- upgraded the project model to support project -> version -> document -> stage -> task
- made project completion equal current version completion
- surfaced current version progress and next target on the multi-project homepage

### Document-First Task Flow

- added a required preparation flow before manual task creation
- enforced goal document update notes and implementation document update notes
- stored task preparation history on the version

### Old Project Iteration

- added version initialization for projects without a version workspace
- added "new version" flow for existing projects
- generated version template documents and stage skeletons automatically

### Development Integration

- added a development integration entry for APIs, modules, and features
- first report creates a task automatically
- repeated reports with the same integration key update the same task

### Folder Sync Outputs

- linked project folders now receive `.task-manager/README.md`
- linked project folders now receive mirrored version target and implementation documents
- kept `.task-manager.json` as the state sync file
