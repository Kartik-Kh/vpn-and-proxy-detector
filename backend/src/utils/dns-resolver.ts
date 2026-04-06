import { promises as dns } from 'dns';

/**
 * Resolves a domain name to IP address(es)
 * @param domain - Domain name to resolve (e.g., "google.com")
 * @returns Promise with resolved IP address (preferring IPv4)
 */
export async function resolveDomainToIP(domain: string): Promise<string> {
  try {
    // Try to resolve IPv4 addresses first
    const addresses = await dns.resolve4(domain);
    if (addresses && addresses.length > 0) {
      return addresses[0];
    }
  } catch (ipv4Error) {
    console.log(`IPv4 resolution failed for ${domain}, trying IPv6...`);
  }

  try {
    // Fallback to IPv6 if IPv4 fails
    const addresses = await dns.resolve6(domain);
    if (addresses && addresses.length > 0) {
      return addresses[0];
    }
  } catch (ipv6Error) {
    throw new Error(`Unable to resolve domain: ${domain}`);
  }

  throw new Error(`No DNS records found for: ${domain}`);
}

/**
 * Checks if input is a valid domain name
 * @param input - String to validate
 * @returns boolean indicating if input is a valid domain
 */
export function isDomain(input: string): boolean {
  // Basic domain validation regex
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(input);
}

/**
 * Checks if input is a valid IP address (IPv4 or IPv6)
 * @param input - String to validate
 * @returns boolean indicating if input is a valid IP
 */
export function isIP(input: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified - matches most common formats)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::)$/;
  
  return ipv4Regex.test(input) || ipv6Regex.test(input);
}

/**
 * Determines input type and resolves to IP if needed
 * @param input - IP address or domain name
 * @returns Object containing resolved IP and original input type
 */
export async function resolveInput(input: string): Promise<{ ip: string; inputType: 'ip' | 'domain'; originalInput: string }> {
  const trimmedInput = input.trim();
  
  if (isIP(trimmedInput)) {
    return {
      ip: trimmedInput,
      inputType: 'ip',
      originalInput: trimmedInput
    };
  }
  
  if (isDomain(trimmedInput)) {
    const resolvedIP = await resolveDomainToIP(trimmedInput);
    return {
      ip: resolvedIP,
      inputType: 'domain',
      originalInput: trimmedInput
    };
  }
  
  throw new Error(`Invalid input: Must be a valid IP address or domain name`);
}
