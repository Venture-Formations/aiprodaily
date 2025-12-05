import Link from 'next/link'
import Image from 'next/image'

import { Container } from '@/components/salient/Container'
import { NavLink } from '@/components/salient/NavLink'

interface FooterProps {
  logoUrl?: string
  newsletterName?: string
  businessName?: string
  currentYear?: number
}

export function Footer({
  logoUrl = '/logo.png',
  newsletterName = 'AI Accounting Daily',
  businessName = 'AI Accounting Daily',
  currentYear = new Date().getFullYear(),
}: FooterProps) {
  return (
    <footer className="bg-slate-50">
      <Container>
        <div className="py-16">
          <Link href="/" className="mx-auto block w-fit">
            <Image
              src={logoUrl}
              alt={newsletterName}
              width={140}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="mt-10 text-sm" aria-label="quick links">
            <div className="-my-1 flex justify-center gap-x-6">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/contactus">Contact</NavLink>
            </div>
          </nav>
        </div>
        <div className="flex flex-col items-center border-t border-slate-400/10 py-10">
          <p className="text-sm text-slate-500">
            Copyright &copy; {currentYear} {businessName}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  )
}
