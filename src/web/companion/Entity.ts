/**
 * Ported from Bitfocus Companion v5.1.0 (MIT licence): shared-lib/lib/Entity.ts
 */
import type { EntityDefinition, FeedbackListType } from '../api/CompanionApi.js'

/** Whether a feedback definition may be added to a list of the given type (null = a plain feedback list) */
export function canAddEntityToFeedbackList(
	feedbackListType: FeedbackListType | null,
	definition: EntityDefinition
): boolean {
	switch (feedbackListType) {
		case null:
			return definition.feedbackType !== 'value'
		case 'boolean':
			return definition.feedbackType === 'boolean'
		case 'value':
			return definition.feedbackType === 'value' || definition.feedbackType === 'boolean'
		case 'advanced':
		case 'style-override':
			if (definition.feedbackStyleOverridesUnsupported) return false
			return (
				definition.feedbackType === 'advanced' ||
				definition.feedbackType === 'boolean' ||
				definition.feedbackType === 'value'
			)
		default:
			return false
	}
}
