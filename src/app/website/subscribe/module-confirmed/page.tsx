import { Container } from "@/components/salient/Container"

export const dynamic = 'force-dynamic'

export default async function ModuleConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; error?: string }>
}) {
  const params = await searchParams
  const name = params.name
  const error = params.error

  const errorMessages: Record<string, string> = {
    missing_params: 'The subscribe link was missing required information.',
    invalid_email: 'This link needs to be opened from your email client.',
    unavailable: 'This newsletter recommendation is no longer available.',
    failed: 'Something went wrong. Please try again later.',
  }

  const isError = !!error
  const errorMessage = error ? errorMessages[error] || errorMessages.failed : null

  return (
    <main className="min-h-[100dvh] bg-white px-4">
      <section className="pt-16 sm:pt-24 pb-16">
        <Container>
          <div className="mx-auto max-w-lg text-center">
            {isError ? (
              <>
                <div className="text-5xl mb-6">&#x26A0;&#xFE0F;</div>
                <h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-3xl mb-4">
                  Oops!
                </h1>
                <p className="text-lg text-slate-600">
                  {errorMessage}
                </p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-6">&#x2705;</div>
                <h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-3xl mb-4">
                  You&apos;re Subscribed!
                </h1>
                <p className="text-lg text-slate-600">
                  {name
                    ? <>You&apos;ve been subscribed to <strong>{name}</strong>. Check your inbox for a welcome email.</>
                    : <>Your subscription has been confirmed. Check your inbox for a welcome email.</>
                  }
                </p>
              </>
            )}
            <div className="mt-8">
              <a
                href="https://aiprodaily.com"
                className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Back to AI Pro Daily
              </a>
            </div>
          </div>
        </Container>
      </section>
    </main>
  )
}
