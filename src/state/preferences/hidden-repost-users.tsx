import * as React from 'react'

import * as persisted from '#/state/persisted'

type SetStateCb = (
  s: persisted.Schema['hiddenRepostUsers'],
) => persisted.Schema['hiddenRepostUsers']

type StateContext = persisted.Schema['hiddenRepostUsers']
type ApiContext = {
  hideRepostsFromUser: ({did}: {did: string}) => void
  showRepostsFromUser: ({did}: {did: string}) => void
  isRepostHidden: (did: string) => boolean
}

const stateContext = React.createContext<StateContext>(
  persisted.defaults.hiddenRepostUsers,
)
stateContext.displayName = 'HiddenRepostUsersStateContext'
const apiContext = React.createContext<ApiContext>({
  hideRepostsFromUser: () => {},
  showRepostsFromUser: () => {},
  isRepostHidden: () => false,
})
apiContext.displayName = 'HiddenRepostUsersApiContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState(persisted.get('hiddenRepostUsers'))

  const setStateWrapped = React.useCallback(
    (fn: SetStateCb) => {
      const s = fn(persisted.get('hiddenRepostUsers'))
      setState(s)
      persisted.write('hiddenRepostUsers', s)
    },
    [setState],
  )

  const api = React.useMemo(
    () => ({
      hideRepostsFromUser: ({did}: {did: string}) => {
        setStateWrapped(s => {
          const current = s || []
          if (current.includes(did)) {
            return current
          }
          return [...current, did]
        })
      },
      showRepostsFromUser: ({did}: {did: string}) => {
        setStateWrapped(s => (s || []).filter(d => d !== did))
      },
      isRepostHidden: (did: string) => {
        return (state || []).includes(did)
      },
    }),
    [setStateWrapped, state],
  )

  React.useEffect(() => {
    return persisted.onUpdate('hiddenRepostUsers', nextHiddenRepostUsers => {
      setState(nextHiddenRepostUsers)
    })
  }, [setStateWrapped])

  return (
    <stateContext.Provider value={state}>
      <apiContext.Provider value={api}>{children}</apiContext.Provider>
    </stateContext.Provider>
  )
}

export function useHiddenRepostUsers() {
  return React.useContext(stateContext)
}

export function useHiddenRepostUsersApi() {
  return React.useContext(apiContext)
}
