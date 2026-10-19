/**
 * Hand-written types for the parts of Companion's tRPC api that this editor uses.
 * Mirrors `shared-lib/lib/Model/*` as of Companion 5.1.0. Companion's internal api is not versioned,
 * so check these against the target version when upgrading. See docs/companion-5.1-api.md.
 */
import type { Operation } from 'fast-json-patch'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface ControlLocation {
	pageNumber: number
	row: number
	column: number
}

// ---- Pages (`pages.watch`) ----

export interface PageModel {
	id: string
	name: string
	/** row -> column -> controlId */
	controls: Record<number, Record<number, string>>
}
export type PageModelChanges =
	| { type: 'init'; order: string[]; pages: Record<string, PageModel | undefined> }
	| {
			type: 'update'
			updatedOrder: string[] | null
			added: PageModel[]
			changes: Array<{
				id: string
				name: string | null
				controls: Array<{ row: number; column: number; controlId: string | null }>
			}>
	  }

// ---- Option values ----

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }
export type ExpressionableOptions = Record<string, ExpressionOrValue<JsonValue | undefined> | undefined>

// ---- Entities (actions and feedbacks) ----

export type EntityType = 'action' | 'feedback'

export interface EntityModel {
	type: EntityType
	id: string
	definitionId: string
	connectionId: string
	headline?: string
	options: ExpressionableOptions
	disabled?: boolean
	upgradeIndex: number | undefined
	/** Only on internal entities with child groups (logic_if, logic_operator, ...) */
	children?: Record<string, EntityModel[] | undefined>
	// feedbacks
	isInverted?: ExpressionOrValue<boolean>
	variableName?: string
	styleOverrides?: unknown[]
	// actions
	storeResult?: unknown
}

/** A set of actions on a step: press, release, rotate, or a numeric "held for N ms" duration group */
export type ActionSetId = 'down' | 'up' | 'rotate_left' | 'rotate_right' | number

/**
 * Which top-level list an entity lives in. Nested entities are addressed by their id within the
 * top-level list, because Companion searches the list recursively.
 */
export type EntityLocation = 'feedbacks' | 'trigger_actions' | 'local-variables' | { stepId: string; setId: ActionSetId }

/** The parent of an entity inside a child group, or null for the top level of a list */
export interface EntityOwner {
	parentId: string
	childGroup: string
}

export type FeedbackListType = 'boolean' | 'value' | 'advanced' | 'style-override'

// ---- Controls (`controls.watchControl`) ----

export interface StepModel {
	/** Keys are 'down' | 'up' | 'rotate_left' | 'rotate_right' | a number serialised as a string */
	action_sets: Record<string, EntityModel[] | undefined>
	options: { runWhileHeld: number[]; name?: string }
}

export interface LayeredButtonModel {
	type: 'button-layered'
	options: {
		stepProgression: 'auto' | 'manual' | 'expression'
		stepExpression?: string
		rotaryActions: boolean
		canModifyStyleInApis: boolean
		notes?: string
	}
	style: { layers: Array<{ id: string; name: string; type: string } & Record<string, unknown>> }
	feedbacks: EntityModel[]
	localVariables: EntityModel[]
	steps: Record<string, StepModel>
}

export type ControlConfig = LayeredButtonModel | ({ type: string } & Record<string, unknown>)

export function isLayeredButton(config: ControlConfig | null | undefined): config is LayeredButtonModel {
	return config?.type === 'button-layered'
}

export type UIControlUpdate =
	| { type: 'init'; config: ControlConfig; runtime: Record<string, unknown> }
	| { type: 'config'; patch: Operation[] }
	| { type: 'runtime'; patch: Operation[] }
	| { type: 'destroy' }

// ---- Definitions (`instances.definitions.actions` / `.feedbacks`) ----

export interface DropdownChoice {
	id: string | number
	label: string
}

export interface IsVisibleUiFn {
	type: 'function' | 'expression'
	fn: string
	data?: unknown
}

/**
 * An option field from a definition. Only the attributes this editor reads are listed; `type` decides
 * which apply (see `OptionsInputControl.tsx` / `InternalModuleField.tsx` in Companion's webui).
 */
export interface OptionField {
	id: string
	type: string
	label: string
	tooltip?: string
	description?: string
	expressionDescription?: string
	isVisibleUi?: IsVisibleUiFn
	disableAutoExpression?: boolean
	default?: JsonValue
	// textinput
	placeholder?: string
	multiline?: boolean
	useVariables?: string | boolean
	regex?: string
	// dropdown / multidropdown
	choices?: DropdownChoice[]
	allowCustom?: boolean
	minSelection?: number
	maxSelection?: number
	// number
	min?: number
	max?: number
	step?: number
	range?: boolean
	allowNull?: boolean
	// checkbox
	displayToggle?: boolean
	// colorpicker
	enableAlpha?: boolean
	returnType?: 'number' | 'string'
	// static-text
	value?: string
	// internal fields
	multiple?: boolean
	includeAll?: boolean
	includeNone?: boolean
	includeStartup?: boolean
	includeDirection?: boolean
	supportsLocal?: boolean
}

export interface EntityChildGroupDefinition {
	type: EntityType
	groupId: string
	entityTypeLabel: string
	label: string
	hint?: string
	feedbackListType?: FeedbackListType
	maximumChildren?: number
}

export interface EntityDefinition {
	entityType: EntityType
	label: string
	sortKey: string | null
	description: string | undefined
	options: OptionField[]
	feedbackType: FeedbackListType | null
	hasLearn: boolean
	showInvert: boolean
	optionsSupportExpressions: boolean
	supportsChildGroups: EntityChildGroupDefinition[]
	showButtonPreview: boolean
	feedbackStyleOverridesUnsupported?: boolean
}

/** connectionId -> definitionId -> definition */
export type EntityDefinitions = Record<string, Record<string, EntityDefinition | undefined> | undefined>

export type EntityDefinitionUpdate =
	| { type: 'init'; definitions: EntityDefinitions }
	| { type: 'add-connection'; connectionId: string; entities: Record<string, EntityDefinition> }
	| { type: 'forget-connection'; connectionId: string }
	| {
			type: 'update-connection'
			connectionId: string
			added: Record<string, EntityDefinition>
			changed: Record<string, Operation[]>
			removed: string[]
	  }

// ---- Other read apis ----

/** `userConfig.watchConfig` (only the fields we read) */
export interface UserConfigGridSize {
	minColumn: number
	maxColumn: number
	minRow: number
	maxRow: number
}
/** Companion's "Admin UI Password" settings (`shared-lib/lib/Model/UserConfigModel.ts`) */
export interface UserConfigAdminLock {
	admin_lockout: boolean
	/** Minutes of inactivity before the UI locks again; 0 = never */
	admin_timeout: number
	admin_password: string
}
export type UserConfigUpdate =
	| {
			type: 'init'
			config: { gridSize: UserConfigGridSize } & Partial<UserConfigAdminLock> & Record<string, unknown>
	  }
	| { type: 'key'; key: string; value: unknown }

/** `instances.connections.watch` (only the fields we read) */
export interface ClientConnectionConfig {
	id: string
	label: string
	moduleId: string
	enabled: boolean
	sortOrder: number
}
export type ClientConnectionsUpdate =
	| { type: 'init'; info: Record<string, ClientConnectionConfig> }
	| { type: 'update'; id: string; info: ClientConnectionConfig }
	| { type: 'remove'; id: string }

/** `customVariables.watch` */
export interface CustomVariableInfo {
	description: string
}
export type CustomVariablesUpdate =
	| { type: 'init'; info: Record<string, CustomVariableInfo> }
	| { type: 'update'; itemId: string; info: CustomVariableInfo }
	| { type: 'remove'; itemId: string }

/** `preview.graphics.location` */
export interface WrappedImage {
	image: string | null
	isUsed: boolean
}
