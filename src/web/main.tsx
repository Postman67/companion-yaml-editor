import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createCompanionClient, type ConnectionState } from './api/trpc.js'
import { App } from './App.js'
import { CompanionStores, StoresContext } from './stores/CompanionStores.js'
import { Store } from './stores/Store.js'

const connectionState = new Store<ConnectionState>('connecting')
const client = createCompanionClient((state) => connectionState.set(state))
const stores = new CompanionStores(client, connectionState)

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<StoresContext.Provider value={stores}>
			<App />
		</StoresContext.Provider>
	</StrictMode>
)
