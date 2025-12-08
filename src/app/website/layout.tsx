import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Script from "next/script"

export const metadata: Metadata = {
  title: "AI Accounting Daily - Stay Ahead of AI in Accounting",
  description: "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes.",
  other: {
    'impact-site-verification': '95d00837-a42c-4e90-abfb-559b7845cfa8',
  },
}

export default function WebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || ''

  // JSON-LD structured data for Organization
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "AI Accounting Daily",
    "url": "https://aiaccountingdaily.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://aiaccountingdaily.com/logo.png"
    },
    "description": "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes."
  }

  // JSON-LD structured data for WebSite
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AI Accounting Daily",
    "url": "https://aiaccountingdaily.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://aiaccountingdaily.com/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* SparkLoop Upscribe */}
      <Script
        id="sparkloop-embed"
        src="https://js.sparkloop.app/embed.js?publication_id=pub_6b958dc16ac6"
        strategy="afterInteractive"
        data-sparkloop=""
      />

      {/* Facebook Pixel */}
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
                fbq('init', '${pixelId}');
                fbq('track', 'PageView');
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
