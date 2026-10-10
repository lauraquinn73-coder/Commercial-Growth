// Public IPv4/IPv6 DNS results are checked before requesting a third-party site.
// DNS results can change; this check complements (not replaces) provider network safeguards.
export function isPublicIPv4(address) {
  const octets = address.split('.');
  if (octets.length !== 4 || octets.some(x => !/^\d{1,3}$/.test(x) || Number(x) > 255 || (x.length > 1 && x[0] === '0'))) return false;
  const [a,b,c] = octets.map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 || a === 192 && b === 88 && c === 99 || a === 192 && b === 0 && (c === 0 || c === 2) || a === 198 && b === 18 || a === 198 && b === 19 || a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113 || a === 192 && b === 88 && c === 99) return false;
  return true;
}
export function isPublicIPv6(ip) {
  const val = String(ip).toLowerCase();
  if (!/^[0-9a-f:.]+$/.test(val) || !val.includes(':') || val.includes('%') || val.startsWith('::ffff:')) return false;
  if (val === '::' || val === '::1' || /^f[cd]/.test(val) || /^fe[89ab]/.test(val) || /^ff/.test(val) || /^2001:db8(?::|$)/.test(val) || /^2002:/.test(val) || /^2001:0:/.test(val)) return false;
  // Non-global reserved space (2000::/3 is global unicast).
  if (!/^[23][0-9a-f]*:/.test(val)) return false;
  return true;
}

// Server-side restrictions are authoritative; browser validation is only for UX.
export function acceptedHostname(host) {
  const labels = host.toLowerCase().split('.');
  return labels.length >= 2 && labels.every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) && labels.at(-1).length >= 2;
}

export function robotsAllowsHomepage(body) {
  // robots.txt user-agent group matching, with specific scanner group taking precedence.
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = []; rules = [];
  };
  for (const line of String(body).split(/\r?\n/)) {
    const m = /^\s*([a-z-]+)\s*:\s*([^#]*)/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && agents.length) {
      rules.push({ key, value });
    }
  }
  flush();
  const scanner = groups.filter(g => g.agents.includes('commercialgrowthscanner'));
  const applicable = scanner.length ? scanner : groups.filter(g => g.agents.includes('*'));
  // Conservative root rule. Handle global '/' and '/*' denial; other paths do not
  // include the root homepage, except rules beginning with '/' with no suffix.
  let allow = true;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.key === 'disallow' && (rule.value === '/' || rule.value === '/*' || rule.value === '/$')) allow = false;
      if (rule.key === 'allow' && (rule.value === '/' || rule.value === '/*' || rule.value === '/$')) allow = true;
    }
  }
  return allow;
}
