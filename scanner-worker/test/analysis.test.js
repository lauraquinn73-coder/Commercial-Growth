import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicHomepage,assessHomepage} from '../analyse.js';

test('normal valid homepage',()=>assert.equal(validatePublicHomepage('https://example.ie/').hostname, 'example.ie'));
test('rejects unsupported or nonpublic targets',()=>{
  for(const url of [
    'http://example.ie/','https://127.0.0.1/','https://localhost/','https://a.local/',
    'https://user:pw@example.ie/','https://example.ie:8888/',
    'https://example.ie/private','https://example.ie/?x=y','https://[::1]/',
    'https://2130706433/','https://internal.example.local/'
  ]) assert.throws(()=>validatePublicHomepage(url),undefined,url);
});
test('identifies absent contact and conversion signals as potential gaps, not confirmed revenue impact',()=>{
  const r=assessHomepage({hrefs:[],actionText:'',heading:'Welcome',title:'Example',description:'',visibleCopy:'',hasTelephone:false,hasEmail:false},'https://example.ie/');
  assert.equal(r.ok,true);
  assert.equal(r.findings.length,4);
  assert.match(r.findings[0].title,/Make the next step/);
  assert.ok(!JSON.stringify(r).includes('€'));
});
test('labels observed CTAs and trust claims as observed, not verified',()=>{
  const r=assessHomepage({hrefs:['/book','/reviews','mailto:info@example.ie'],actionText:'Book now',heading:'Consulting services',title:'Example',description:'Consulting help',visibleCopy:'Read our testimonials',hasTelephone:false,hasEmail:true},'https://example.ie/');
  assert.match(r.findings[0].title,/detected/);
  assert.match(r.findings[2].title,/credibility/);
});
test('refuses credentials, local names and subpaths even if a URL parses',()=>{
  for(const url of ['https://foo.example/','https://foo.test/','https://foo.internal/','https://example.ie/admin','https://user@example.ie/']) {
    assert.throws(()=>validatePublicHomepage(url),undefined,url);
  }
});
