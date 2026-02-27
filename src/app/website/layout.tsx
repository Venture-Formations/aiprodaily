import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Script from "next/script"
import { resolvePublicationFromRequest } from '@/lib/publication-settings'

export const metadata: Metadata = {
  title: "AI Accounting Daily - Stay Ahead of AI in Accounting",
  description: "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes.",
  other: {
    'impact-site-verification': '95d00837-a42c-4e90-abfb-559b7845cfa8',
    'google-adsense-account': 'ca-pub-1173459595320946',
  },
}

export default async function WebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { host, settings } = await resolvePublicationFromRequest()
  const siteUrl = `https://${host}`
  const newsletterName = settings.newsletter_name || 'Newsletter'
  const businessName = settings.business_name || 'Newsletter'
  const logoUrl = settings.logo_url || '/logo.png'

  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || ''

  // JSON-LD structured data for Organization
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": businessName,
    "url": siteUrl,
    "logo": {
      "@type": "ImageObject",
      "url": logoUrl.startsWith('http') ? logoUrl : `${siteUrl}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`
    },
    "description": `Daily insights, tools, and strategies from ${newsletterName}.`
  }

  // JSON-LD structured data for WebSite
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": newsletterName,
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteUrl}/?search={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  }

  return (
    <>
      {/* Consent Mode v2 defaults — must run before any Google/ad scripts */}
      <Script
        id="consent-mode-defaults"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied',
              wait_for_update: 500
            });
          `,
        }}
      />

      {/* Hide default CCPA bar; we show a footer link that opens the opt-out dialog (Privacy & Messaging API) */}
      <Script
        id="google-fc-override-dns-link"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.googlefc = window.googlefc || {};
            window.googlefc.usstatesoptout = window.googlefc.usstatesoptout || {};
            window.googlefc.usstatesoptout.overrideDnsLink = true;
          `,
        }}
      />

      {/* Google Funding Choices — loads the CMP consent banner configured in AdSense Privacy & Messaging */}
      <Script
        id="google-fc"
        strategy="beforeInteractive"
        src="https://fundingchoicesmessages.google.com/i/pub-1173459595320946?ers=1"
        nonce=""
      />
      <Script
        id="google-fc-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function() {function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){var i=document.createElement('iframe');i.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';i.style.display='none';i.name='googlefcPresent';document.body.appendChild(i);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();`,
        }}
      />

      {/* Google AdSense */}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1173459595320946"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* Facebook Pixel — respects Consent Mode; loads SDK but defers tracking until consent granted */}
      {pixelId && (
        <>
          <Script
            id="facebook-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('consent', 'revoke');
                fbq('init', '${pixelId}');
                fbq('track', 'PageView');

                // When Google CMP grants consent, also grant Facebook Pixel consent
                if (window.googlefc) {
                  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
                  window.googlefc.callbackQueue.push({'CONSENT_DATA_READY': function() {
                    if (typeof gtag === 'function') {
                      // Check if ad_storage was granted by reading the consent state
                      // Google CMP auto-updates gtag consent; mirror to fbq
                      fbq('consent', 'grant');
                    }
                  }});
                }
              `,
            }}
          />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
      {children}
    </>
  )
}
