import type { ControlLocation } from '../api/CompanionApi.js'
import { useLocationPreview } from '../stores/CompanionStores.js'
import type { SummaryPart } from './Summarise.js'

/** The muted "label value · label value" part of a row */
export function SummaryView({ parts }: { parts: SummaryPart[] }) {
	if (parts.length === 0) return <span className="summary" />
	return (
		<span className="summary">
			{parts.map((part, i) => (
				<span key={i} className="summary-part">
					{part.label ? <span className="summary-label">{part.label}</span> : null}
					<SummaryValue part={part} />
				</span>
			))}
		</span>
	)
}

function SummaryValue({ part }: { part: SummaryPart }) {
	switch (part.kind) {
		case 'text':
			return <span className="summary-value">{part.text}</span>
		case 'expression':
			return <code className="summary-value expression">{part.text}</code>
		case 'color':
			return (
				<span className="summary-value">
					<span className="swatch" style={{ background: part.color }} />
					{part.color}
				</span>
			)
		case 'location':
			return <LocationValue location={part.location} />
	}
}

/** A button location with a thumbnail of that button, so "4/1/5" shows what it points at */
function LocationValue({ location }: { location: string }) {
	const [pageNumber, row, column] = location.split('/').map(Number) as [number, number, number]
	const target: ControlLocation | null = pageNumber > 0 ? { pageNumber, row, column } : null
	const preview = useLocationPreview(target)
	return (
		<a className="summary-value location" href={`#/${location}`} title={`Go to button ${location}`}>
			{preview?.image ? <img src={preview.image} alt="" /> : null}
			{location}
		</a>
	)
}
