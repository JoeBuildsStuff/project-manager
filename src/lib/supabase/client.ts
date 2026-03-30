type AuthStateSubscription = {
  data: {
    subscription: {
      unsubscribe: () => void
    }
  }
}

type SessionStub = {
  user: null
} | null

type SupabaseClientStub = {
  auth: {
    getUser: () => Promise<{ data: { user: null } }>
    onAuthStateChange: (
      callback: (event: string, session: SessionStub) => void
    ) => AuthStateSubscription
  }
}

function createStubClient(): SupabaseClientStub {
  return {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: (callback) => {
        callback("SIGNED_OUT", null)
        return {
          data: {
            subscription: {
              unsubscribe: () => undefined,
            },
          },
        }
      },
    },
  }
}

export function createClient() {
  return createStubClient()
}
