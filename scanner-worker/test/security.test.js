import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicIPv4,isPublicIPv6,robotsAllowsHomepage,acceptedHostname} from '../security.js';

test('public DNS IPv4 classification rejects private, loopback, documentation and reserved ranges',()=>{
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.20','169.254.169.254','100.100.100.100','198.51.100.1','203.0.113.6','0.1.2.3','224.0.0.1','999.1.1.1']) {
    assert.equal(isPublicIPv4(ip),false,ip);
  }
  assert.equal(isPublicIPv4('1.1.1.1'),true);
  assert.equal(isPublicIPv4('8.8.8.8'),true);
});

test('public DNS IPv6 classification rejects local and documentation addresses',()=>{
  for (const ip of ['::1','::','fe80::1','fc00::1','fd02::1','2001:db8::1','ff02::1','::ffff:127.0.0.1']) {
    assert.equal(isPublicIPv6(ip),false,ip);
  }
  assert.equal(isPublicIPv6('2606:4700:4700::1111'),true);
});

test('DNS domain rules reject invalid labels and accept typical websites',()=>{
  for(const host of ['-abc.ie','a-.ie','my..ie','bad_symbol.ie','x.c','']) assert.equal(acceptedHostname(host),false,host);
  for(const host of ['commercialgrowth.ie','www.example.ie','xn--bcher-kva.de']) assert.equal(acceptedHostname(host),true,host);
});

test('robots root disallow blocks, an unrelated group does not, scanner-specific rules win',()=>{
  assert.equal(robotsAllowsHomepage('User-agent: *\nDisallow: /'),false);
  assert.equal(robotsAllowsHomepage('User-agent: *\nDisallow: /admin'),true);
  assert.equal(robotsAllowsHomepage('User-agent: ExampleBot\nDisallow: /'),true);
  assert.equal(robotsAllowsHomepage('User-agent: *\nDisallow: /\n\nUser-agent: CommercialGrowthScanner\nAllow: /'),true);
  assert.equal(robotsAllowsHomepage('User-agent: *\nAllow: /\nDisallow: /'),false);
});
