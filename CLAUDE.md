# CV-Reformatter

## Commands
- `pnpm dev` / `pnpm build` / `pnpm test --run`
- `pnpm db:push` - Sync schema | `pnpm worker` - Start BullMQ worker

## Architecture
- **State**: Zustand (`lib/stores/`) + React Query (`lib/queries/`)
- **Hooks métier**: `lib/hooks/` (useCVActions, useWorkflow, useAutoSave)
- **Types**: `lib/types.ts` → `TemplateListItem`, `CVWithImprovementsAndAudio`

## Patterns
- Sanitization: `sanitizeName(str, { allowDots, allowDashes })` de `lib/utils.ts`
- API Routes: `apiRoute().body(schema).handler(...)` de `lib/api-route.ts`

## Testing Gotchas
- `NextRequest` + `FormData` → mock `request.formData()` manuellement
- `File.arrayBuffer()` n'existe pas en Node → ajouter `(file as any).arrayBuffer = async () => content`
