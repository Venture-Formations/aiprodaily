/**
 * Known IP Ranges for Email Security Scanners and Bots
 *
 * These services automatically click links in emails to scan for malware,
 * phishing, and other threats before delivering to recipients.
 *
 * Sources:
 * - Microsoft: https://learn.microsoft.com/en-us/microsoft-365/enterprise/urls-and-ip-address-ranges
 * - Barracuda: https://campus.barracuda.com/product/essentials/doc/78154145/
 * - Mimecast: https://community.mimecast.com/s/article/Mimecast-IP-Ranges
 * - Proofpoint: https://help.proofpoint.com/Threat_Insight_Dashboard/Concepts/IP_addresses
 */

export interface KnownIPRange {
  cidr: string
  organization: string
  type: 'email_scanner' | 'cloud_provider' | 'vpn' | 'bot'
  description?: string
}

/**
 * Known email security scanner and cloud provider IP ranges
 * These generate false positives in link click analytics
 */
export const KNOWN_IP_RANGES: KnownIPRange[] = [
  // Microsoft Defender for Office 365 / Exchange Online Protection
  { cidr: '40.94.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.95.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.96.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.97.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.98.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.99.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.100.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.101.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.102.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.103.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.104.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.105.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.106.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '40.107.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 Defender' },
  { cidr: '52.96.0.0/12', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365' },
  { cidr: '104.47.0.0/17', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft 365 EOP' },
  { cidr: '128.85.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft Azure' },
  { cidr: '72.152.0.0/14', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft Azure' },
  { cidr: '20.33.0.0/16', organization: 'Microsoft', type: 'email_scanner', description: 'Microsoft Azure' },
  { cidr: '20.40.0.0/13', organization: 'Microsoft', type: 'cloud_provider', description: 'Microsoft Azure' },
  { cidr: '20.128.0.0/16', organization: 'Microsoft', type: 'cloud_provider', description: 'Microsoft Azure' },

  // Barracuda Email Security
  { cidr: '64.235.144.0/20', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Email Security' },
  { cidr: '209.222.80.0/21', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Email Security' },
  { cidr: '198.54.117.0/24', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Sentinel' },
  { cidr: '198.54.118.0/24', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Sentinel' },
  { cidr: '198.54.119.0/24', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Sentinel' },
  { cidr: '198.54.120.0/24', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Sentinel' },
  { cidr: '198.54.121.0/24', organization: 'Barracuda', type: 'email_scanner', description: 'Barracuda Sentinel' },

  // Mimecast
  { cidr: '91.220.42.0/24', organization: 'Mimecast', type: 'email_scanner', description: 'Mimecast Email Security' },
  { cidr: '91.220.43.0/24', organization: 'Mimecast', type: 'email_scanner', description: 'Mimecast Email Security' },
  { cidr: '195.130.217.0/24', organization: 'Mimecast', type: 'email_scanner', description: 'Mimecast Email Security' },
  { cidr: '207.211.30.0/24', organization: 'Mimecast', type: 'email_scanner', description: 'Mimecast Email Security' },
  { cidr: '207.211.31.0/24', organization: 'Mimecast', type: 'email_scanner', description: 'Mimecast Email Security' },
  { cidr: '170.10.128.0/17', organization: 'Mimecast', type: 'email_scanner', description: 'Mimecast US' },

  // Proofpoint
  { cidr: '67.231.144.0/20', organization: 'Proofpoint', type: 'email_scanner', description: 'Proofpoint Email Security' },
  { cidr: '67.231.152.0/21', organization: 'Proofpoint', type: 'email_scanner', description: 'Proofpoint Email Security' },
  { cidr: '148.163.128.0/17', organization: 'Proofpoint', type: 'email_scanner', description: 'Proofpoint Email Security' },
  { cidr: '185.132.180.0/22', organization: 'Proofpoint', type: 'email_scanner', description: 'Proofpoint EU' },

  // Google Workspace / Gmail
  { cidr: '66.102.0.0/20', organization: 'Google', type: 'email_scanner', description: 'Google Workspace' },
  { cidr: '66.249.64.0/19', organization: 'Google', type: 'bot', description: 'Googlebot' },
  { cidr: '72.14.192.0/18', organization: 'Google', type: 'email_scanner', description: 'Google Mail' },
  { cidr: '74.125.0.0/16', organization: 'Google', type: 'email_scanner', description: 'Google Mail' },
  { cidr: '108.177.0.0/17', organization: 'Google', type: 'email_scanner', description: 'Google' },
  { cidr: '142.250.0.0/15', organization: 'Google', type: 'email_scanner', description: 'Google' },
  { cidr: '172.217.0.0/16', organization: 'Google', type: 'email_scanner', description: 'Google' },
  { cidr: '173.194.0.0/16', organization: 'Google', type: 'email_scanner', description: 'Google' },
  { cidr: '209.85.128.0/17', organization: 'Google', type: 'email_scanner', description: 'Google' },

  // Cisco Email Security (IronPort)
  { cidr: '184.94.240.0/20', organization: 'Cisco', type: 'email_scanner', description: 'Cisco Email Security' },

  // Cloudmark (Proofpoint)
  { cidr: '208.83.136.0/21', organization: 'Cloudmark', type: 'email_scanner', description: 'Cloudmark Email Security' },

  // Symantec/Broadcom Email Security
  { cidr: '216.163.176.0/20', organization: 'Symantec', type: 'email_scanner', description: 'Symantec Email Security' },

  // Trend Micro
  { cidr: '150.70.0.0/16', organization: 'Trend Micro', type: 'email_scanner', description: 'Trend Micro Email Security' },

  // Amazon SES / AWS
  { cidr: '54.240.0.0/18', organization: 'Amazon', type: 'email_scanner', description: 'Amazon SES' },
  { cidr: '199.255.192.0/22', organization: 'Amazon', type: 'email_scanner', description: 'Amazon SES' },
]

import { ipMatchesCIDR, parseCIDR } from './ip-utils'

/**
 * Check if an IP address belongs to a known email scanner or cloud provider
 * Returns the matching range info if found, null otherwise
 */
export function getKnownIPRange(ip: string): KnownIPRange | null {
  for (const range of KNOWN_IP_RANGES) {
    const parsed = parseCIDR(range.cidr)
    if (parsed && ipMatchesCIDR(ip, parsed.ip, parsed.prefix)) {
      return range
    }
  }
  return null
}

/**
 * Get all known ranges for a specific organization
 */
export function getKnownRangesByOrganization(organization: string): KnownIPRange[] {
  return KNOWN_IP_RANGES.filter(r =>
    r.organization.toLowerCase() === organization.toLowerCase()
  )
}

/**
 * Get unique organizations from known ranges
 */
export function getKnownOrganizations(): string[] {
  return Array.from(new Set(KNOWN_IP_RANGES.map(r => r.organization)))
}

/**
 * Get recommended CIDR ranges to exclude for a given organization
 * Returns deduplicated list of CIDRs
 */
export function getRecommendedExclusions(organization: string): string[] {
  return getKnownRangesByOrganization(organization).map(r => r.cidr)
}
