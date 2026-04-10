# Chores TODO

## Refactor: Remove Command Palette completely

The Command Palette feature has been hidden and is slated for removal. When ready, perform the following steps to completely delete it from the application:

1. **Delete File**:
   - Delete `src/components/layout/command-palette.tsx` completely.

2. **Clean up Imports and Usages in `AppShell`**:
   - In `src/components/layout/app-shell.tsx`, remove the import statement around line 15:
     ```typescript
     import { CommandPalette } from "@/components/layout/command-palette";
     ```
   - In `src/components/layout/app-shell.tsx`, remove the commented-out component usage around line 83:
     ```tsx
     {/* <CommandPalette /> */}
     ```
