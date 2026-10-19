# Companion 5.1 internals used by this editor

Notes on Companion's internal tRPC api and button-editor logic, as of **v5.1.0**, gathered from the
Companion source (`git show v5.1.0:<path>` in the companion repo). None of this is a public, versioned api,
so recheck it when targeting a new Companion version. Line numbers are at v5.1.0.

## Connection

Websocket `ws(s)://<host>/trpc`, tRPC 11, **no transformer** (plain JSON). Browser clients must be
same-origin (Companion checks `Origin`); non-browser clients send no Origin and are allowed. There is no
authentication. Root router: `companion/lib/UI/TRPC.ts:187-213`.

## Reading

| What | Procedure | Messages |
|---|---|---|
| Pages | `pages.watch` | `{type:'init', order, pages}` then `{type:'update', updatedOrder, added, changes}`. Page number = index+1 in `order`; `pages[id].controls[row][col] = controlId` |
| A control | `controls.watchControl {controlId}` | `{type:'init', config, runtime}`, `{type:'config', patch}` (json patch), `{type:'runtime', patch}`, `{type:'destroy'}` |
| Action / feedback definitions | `instances.definitions.actions` / `.feedbacks` | `{type:'init', definitions: {connectionId: {definitionId: def}}}`, `add-connection`, `forget-connection`, `update-connection {added, changed: json patches, removed}`. Internal ones are under `'internal'` |
| Connections | `instances.connections.watch` | arrays of `{type:'init', info}`, `{type:'update', id, info}`, `{type:'remove', id}` |
| Custom variables | `customVariables.watch` | arrays of `{type:'init', info}`, `{type:'update', itemId, info}`, `{type:'remove', itemId}` |
| Grid size, admin lockout | `userConfig.watchConfig` | `{type:'init', config}`, `{type:'key', key, value}`. The lockout is `admin_lockout`, `admin_timeout` (minutes, 0 = never) and `admin_password`, sent to every client and checked client-side (`webui/src/App.tsx`) |
| Button image | `preview.graphics.location {location}` | `{image: dataUrl, isUsed}` |

Module definitions only exist while the module runs. Some modules (e.g. ProPresenter) only publish their
actions after connecting to their device.

## Button model (`shared-lib/lib/Model/ButtonModel.ts`, `EntityModel.ts`)

```ts
{ type: 'button-layered', options: {stepProgression, stepExpression?, rotaryActions, canModifyStyleInApis, notes?},
  style: {layers}, feedbacks: Entity[], localVariables: Entity[],
  steps: { [stepId]: { action_sets: { down, up, rotate_left?, rotate_right?, [ms]: Entity[] }, options: {runWhileHeld: number[], name?} } } }

Entity { type: 'action'|'feedback', id, definitionId, connectionId, headline?, disabled?, upgradeIndex,
         options: { [key]: { value, isExpression: false } | { value: string, isExpression: true } },
         children?: { [groupId]: Entity[] },            // internal only: logic_if, logic_operator, action_group...
         isInverted?, styleOverrides?, variableName?,   // feedbacks
         storeResult? }                                 // actions
```

## Editing (`controls.entities.*`, `companion/lib/Controls/EntitiesTrpcRouter.ts`)

All take `controlId`. `entityLocation` is the **top-level list**: `'feedbacks' | 'local-variables' | {stepId, setId}`,
where duration-group `setId`s must be **numbers** (`{stepId:'0', setId:1000}`). Nested entities are found by
`entityId` anywhere in that list; only `add` and `move` take an owner `{parentId, childGroup}` (or null).

| Procedure | Input |
|---|---|
| `setOption` | `{entityLocation, entityId, key, value: {value, isExpression}}` |
| `setEnabled` | `{entityLocation, entityId, enabled}` |
| `setHeadline` | `{entityLocation, entityId, headline}` |
| `setInverted` | `{entityLocation, entityId, isInverted: {value, isExpression}}` |
| `setConnection` | `{entityLocation, entityId, connectionId}` (same module only, in the UI) |
| `add` | `{entityLocation, ownerId, connectionId, entityType, entityDefinition}` → new id; the server fills defaults |
| `remove`, `duplicate` | `{entityLocation, entityId}` (duplicate inserts after the original) |
| `move` | `{moveEntityLocation, moveEntityId, newOwnerId, newEntityLocation, newIndex}`; works across lists and into child groups |
| `learnOptions`, `setRawStoreResult`, `replaceStyleOverride`, `removeStyleOverride`, `setVariableName`, `setVariableValue` | see the router |

Steps: `controls.steps.{add, duplicate, remove, swap, setCurrent, rename}`. Duration groups:
`controls.actionSets.{add, remove, rename, setRunWhileHeld}`. Button options: `controls.setOptionsField {controlId, key, value}`.

## Option fields (`webui/src/Controls/OptionsInputField.tsx`, `OptionsInputControl.tsx`, `InternalModuleField.tsx`)

- A value edit is sent as `{isExpression: field.type === 'expression', value}`.
- The expression toggle is offered when `definition.optionsSupportExpressions && !field.disableAutoExpression`
  (not for `expression` / `static-text` fields). Switching to an expression stringifies the value; switching back
  keeps the raw string (no re-typing) - `webui/src/Components/FieldOrExpression.tsx`.
- Visibility (`isVisibleUi`): `expression` form via `shared-lib/lib/IsVisible.ts`; `function` form run in
  `webui/src/Resources/sandbox.ts`. Ported in `src/web/companion/IsVisible.ts`.
- Stored values: dropdown = choice id (string or number, keep the choice's own type); multidropdown = id[];
  colorpicker = `0xRRGGBB` number with alpha above (`0x1000000 * round(255*(1-a))`) or an `rgba()` string;
  `internal:page` = 0 (this page) / `'startup'|'back'|'forward'` / page number; `internal:connection_id` = id or id[];
  a button location is a `textinput` (`page/row/col`, or `$(this:page)/...`).

## Child groups (`companion/lib/Internal/BuildingBlocks.ts`)

`logic_if`: `condition` (boolean feedbacks), `actions` ("Then"), `else_actions` ("Else"). `logic_while`:
`condition`, `actions`. `action_group`: `default`. `logic_operator` (feedback): `default`.
`logic_conditionalise_advanced`: `children`, `feedbacks`.

## Import (used by `scripts/import-config.mjs`)

`importExport.prepareImport.{start {name,size} → sessionId, uploadChunk {sessionId, offset, data: base64},
complete {sessionId, expectedChecksum: sha1, userData: null}}` then `importExport.importFull {config: selection}` →
`{runId}`, followed via `importExport.importExportTaskStatus`. Upload and import must use the same connection.
