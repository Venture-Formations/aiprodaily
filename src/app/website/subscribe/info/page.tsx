import { Container } from "@/components/salient/Container"
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'
import { PersonalizationForm } from "./personalization-form"
import { renderStyledHeading } from "@/components/StyledHeading"
import { resolvePublicationFromRequest, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function SubscribeInfoPage() {
  const { publicationId } = await resolvePublicationFromRequest()

  // Fetch settings from publication_settings
  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name',
    'subscribe_info_heading',
    'subscribe_info_subheading',
    'subscribe_info_job_label',
    'subscribe_info_job_options',
    'subscribe_info_clients_label',
    'subscribe_info_clients_options',
    'subscribe_info_submit_text',
  ])

  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const heading = settings.subscribe_info_heading || 'One Last Step! **Personalize Your Experience**'
  const subheading = settings.subscribe_info_subheading || 'Help us tailor your newsletter to your needs.\nThis only takes 30 seconds!'

  // Parse JSON option arrays (stored as JSON strings in publication_settings)
  let jobOptions: { value: string; label: string }[] | undefined
  if (settings.subscribe_info_job_options) {
    try {
      const parsed = typeof settings.subscribe_info_job_options === 'string'
        ? JSON.parse(settings.subscribe_info_job_options)
        : settings.subscribe_info_job_options
      if (Array.isArray(parsed)) jobOptions = parsed
    } catch { /* use defaults */ }
  }

  let clientsOptions: { value: string; label: string }[] | undefined
  if (settings.subscribe_info_clients_options) {
    try {
      const parsed = typeof settings.subscribe_info_clients_options === 'string'
        ? JSON.parse(settings.subscribe_info_clients_options)
        : settings.subscribe_info_clients_options
      if (Array.isArray(parsed)) clientsOptions = parsed
    } catch { /* use defaults */ }
  }

  return (
    <main className="min-h-[100dvh] bg-white px-4">
      {/* Personalization Section */}
      <section className="pt-8 sm:pt-16 pb-6 sm:pb-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            {/* Logo */}
            <div className="flex justify-center mb-4 sm:mb-6">
              <img
                src={logoUrl}
                alt={newsletterName}
                className="h-20 sm:h-28 w-auto object-contain"
              />
            </div>

            <SubscribeProgressBar step={4} />

            {/* Headline */}
            <h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-4xl">
              {renderStyledHeading(heading)}
            </h1>

            {/* Subheadline */}
            <p className="mt-4 sm:mt-6 text-base sm:text-lg tracking-tight text-slate-700">
              {subheading.split('\n').map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </p>

            {/* Personalization Form */}
            <div className="mt-6 sm:mt-10">
              <PersonalizationForm
                jobLabel={settings.subscribe_info_job_label || undefined}
                jobOptions={jobOptions}
                clientsLabel={settings.subscribe_info_clients_label || undefined}
                clientsOptions={clientsOptions}
                submitText={settings.subscribe_info_submit_text || undefined}
              />
            </div>
          </div>
        </Container>
      </section>
    </main>
  )
}
