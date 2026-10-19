import type { ControlLocation } from './api/CompanionApi.js'
import { useLocationPreview, useStores } from './stores/CompanionStores.js'
import { getPage } from './stores/PagesState.js'
import { useStore } from './stores/Store.js'

/** Page picker and the page's button grid, with live previews */
export function Sidebar({
	location,
	onSelect,
}: {
	location: ControlLocation
	onSelect: (location: ControlLocation) => void
}) {
	const stores = useStores()
	const pages = useStore(stores.pages)
	const gridSize = useStore(stores.gridSize)

	const rows: number[] = []
	for (let row = gridSize.minRow; row <= gridSize.maxRow; row++) rows.push(row)
	const columns: number[] = []
	for (let column = gridSize.minColumn; column <= gridSize.maxColumn; column++) columns.push(column)

	return (
		<aside className="sidebar">
			<label className="field">
				<span>Page</span>
				<select
					value={location.pageNumber}
					onChange={(e) => onSelect({ ...location, pageNumber: Number(e.target.value) })}
				>
					{/* Without an option of its own, a missing page would show as page 1, which then can't be picked */}
					{pages && !getPage(pages, location.pageNumber) ? (
						<option value={location.pageNumber}>{location.pageNumber}: (no such page)</option>
					) : null}
					{pages?.order.map((id, index) => (
						<option key={id} value={index + 1}>
							{index + 1}: {pages.pages[id]?.name || 'PAGE'}
						</option>
					))}
				</select>
			</label>
			<div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length}, auto)` }}>
				{rows.flatMap((row) =>
					columns.map((column) => (
						<GridCell
							key={`${location.pageNumber}/${row}/${column}`}
							location={{ pageNumber: location.pageNumber, row, column }}
							selected={row === location.row && column === location.column}
							onSelect={onSelect}
						/>
					))
				)}
			</div>
		</aside>
	)
}

function GridCell({
	location,
	selected,
	onSelect,
}: {
	location: ControlLocation
	selected: boolean
	onSelect: (location: ControlLocation) => void
}) {
	const preview = useLocationPreview(location)
	const className = ['cell', selected ? 'selected' : '', preview?.isUsed ? '' : 'unused'].join(' ')
	return (
		<button
			type="button"
			className={className}
			title={`Row ${location.row}, column ${location.column}`}
			onClick={() => onSelect(location)}
		>
			{preview?.image ? <img src={preview.image} alt="" /> : null}
		</button>
	)
}
