import {
  CUSTOM_SCRIPTS_MAX_LENGTH,
  checkCustomScripts,
  parseCustomScript,
} from './custom-scripts.util';

/**
 * These tests are the security contract for Settings > SEO > Custom Scripts.
 *
 * The "accepts" block is not padding: this validator guards a feature whose
 * entire job is to run vendor code, so a rule that rejects the snippet every
 * admin will actually paste is worse than no rule at all - it gets removed.
 * Each accepted case below is a real snippet copied from the vendor's own
 * install instructions.
 */
describe('checkCustomScripts', () => {
  const expectOk = (value: string) => {
    const result = checkCustomScripts(value);
    expect(result.reason).toBeNull();
    expect(result.ok).toBe(true);
  };

  const expectRejected = (value: string, matching: RegExp) => {
    const result = checkCustomScripts(value);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(matching);
  };

  describe('accepts what admins actually paste', () => {
    it('empty and whitespace-only (this is how a field is cleared)', () => {
      expectOk('');
      expectOk('   \n  ');
    });

    it("Google Tag Manager's head snippet", () => {
      expectOk(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXX');</script>
<!-- End Google Tag Manager -->`);
    });

    it("Google Tag Manager's noscript iframe (the reason iframes are allowed at all)", () => {
      expectOk(
        `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
      );
    });

    it('Hotjar', () => {
      expectOk(`<script>
(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
h._hjSettings={hjid:1234567,hjsv:6};a=o.getElementsByTagName('head')[0];
r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
</script>`);
    });

    it('an external script by src', () => {
      expectOk(
        '<script async src="https://cdn.example.com/widget.js"></script>',
      );
    });

    it('void tags - a verification meta and a preconnect link', () => {
      // Regression guard: htmlparser2 emits a close event for void elements, so
      // a naive open/close stack would report these as "never closed".
      expectOk('<meta name="facebook-domain-verification" content="abc123" />');
      expectOk('<link rel="preconnect" href="https://cdn.example.com">');
      expectOk('<meta name="x" content="y">');
    });

    it('a style block', () => {
      expectOk('<style>.vendor-badge{display:none}</style>');
    });

    it('several snippets in one field, and uppercase tags', () => {
      expectOk(
        '<SCRIPT>var a=1;</SCRIPT>\n<meta name="a" content="b">\n<style>a{}</style>',
      );
    });

    it('a script containing markup in a STRING (it is JS, not markup)', () => {
      expectOk(
        `<script>document.write('<iframe src="https://x.example"></iframe>');</script>`,
      );
    });
  });

  describe('refuses what hijacks the document', () => {
    it('<base>, which silently re-points every relative URL on the site', () => {
      expectRejected(
        '<base href="https://evil.example/">',
        /<base> is not allowed/,
      );
    });

    it('a bare <iframe>, and says where iframes ARE allowed', () => {
      expectRejected(
        '<iframe src="https://evil.example"></iframe>',
        /only allowed inside <noscript>/,
      );
    });

    it('<form>, <object> and <svg>', () => {
      expectRejected('<form action="/x"></form>', /<form> is not allowed/);
      expectRejected(
        '<object data="x.swf"></object>',
        /<object> is not allowed/,
      );
      expectRejected('<svg><use href="#x"/></svg>', /<svg> is not allowed/);
    });

    it('a tag nobody thought of - the allowlist denies by default', () => {
      expectRejected('<marquee>hi</marquee>', /<marquee> is not allowed/);
      expectRejected(
        '<template><b>x</b></template>',
        /<template> is not allowed/,
      );
    });

    it('markup smuggled inside <noscript>, which has its own allowlist', () => {
      expectRejected(
        '<noscript><form action="https://evil.example"></form></noscript>',
        /<form> is not allowed inside <noscript>/,
      );
    });

    it('inline event handlers', () => {
      expectRejected(
        '<noscript><img src="https://x.example/p.gif" onerror="fetch(\'//evil\')"></noscript>',
        /Inline event handler "onerror"/,
      );
    });

    it('executable URL schemes', () => {
      expectRejected(
        '<noscript><a href="javascript:alert(1)">x</a></noscript>',
        /executable URL scheme/,
      );
      expectRejected(
        '<script src="data:text/html,<script>alert(1)</script>"></script>',
        /executable URL scheme/,
      );
    });

    it('an unclosed tag, which swallows the rest of every page', () => {
      expectRejected('<script>var a = 1;', /<script> is never closed/);
      expectRejected('<noscript><div>', /is never closed/);
    });

    it('loose text, which ends the <head> early', () => {
      expectRejected('paste your script here', /Loose text outside a tag/);
      expectRejected(
        '<script>var a=1;</script> trailing words',
        /Loose text outside a tag/,
      );
    });

    it('anything past the size ceiling', () => {
      const huge = `<script>${'a'.repeat(CUSTOM_SCRIPTS_MAX_LENGTH)}</script>`;
      expectRejected(huge, /the limit is 20000/);
    });
  });

  /**
   * A syntax error is never intentional, and the browser's response is to abort
   * the ENTIRE script - so one stray character silently kills that vendor's
   * tracking on every page, with no signal until someone notices the data
   * stopped. This is the one thing about a script body that can be checked
   * without pretending to know what the code does.
   */
  describe('inline JavaScript syntax', () => {
    it('rejects TypeScript, which is what an admin pastes by accident', () => {
      // The real snippet that took the site down: the browser hits the ':' in
      // the type annotation and throws "Unexpected token ':'".
      expectRejected(
        `<script>
function isNonLocalized(pathname: string): boolean {
  return PREFIXES.some(p => pathname === p);
}
</script>`,
        /not valid JavaScript.*TypeScript is not JavaScript/s,
      );
    });

    it('rejects a half-copied snippet', () => {
      expectRejected(
        '<script>(function(w,d){w.x=1;</script>',
        /not valid JavaScript/,
      );
    });

    it('accepts valid JS, including minified vendor code', () => {
      expectOk(
        '<script>!function(e,t){t.q=t.q||[],t.q.push(["init",e])}("id",window.v=window.v||{});</script>',
      );
    });

    it('leaves JSON-LD alone - it is not JavaScript', () => {
      expectOk(
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>',
      );
    });

    it('leaves a module alone - import never compiles as a classic script', () => {
      expectOk(
        '<script type="module">import { a } from "https://cdn.example.com/m.js"; a();</script>',
      );
    });

    it('leaves a template script alone', () => {
      expectOk('<script type="text/template"><div>{{name}}</div></script>');
    });

    it('does not fire on an external script with no body', () => {
      expectOk('<script src="https://cdn.example.com/w.js"></script>');
    });
  });

  describe('position-dependent rules', () => {
    it('refuses <noscript> in the HEAD, where it would close the head early', () => {
      const result = checkCustomScripts(
        '<noscript><iframe src="https://x.example"></iframe></noscript>',
        'HEAD',
      );
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/cannot go in the <head>/);
    });

    it('allows the same snippet at the end of the body', () => {
      expectOk(
        '<noscript><iframe src="https://x.example"></iframe></noscript>',
      );
    });
  });

  it('never throws, whatever it is handed', () => {
    const junk = [
      '<<<>>>',
      '<script',
      '</script>',
      '<script><script><script>',
      '<!-- unterminated comment',
      ' ',
    ];
    for (const value of junk) {
      expect(() => checkCustomScripts(value)).not.toThrow();
    }
  });
});

/**
 * The render path emits React elements built from these nodes, so this parse is
 * the last thing standing between a database row and every visitor's browser.
 * What matters is that the script BODY survives byte for byte (it is executable
 * code, not markup) while the structure around it is normalised.
 */
describe('parseCustomScript', () => {
  it('splits top-level tags and keeps their attributes', () => {
    expect(
      parseCustomScript(
        '<script async src="https://cdn.example.com/w.js"></script>\n<meta name="a" content="b">',
      ),
    ).toEqual([
      {
        tag: 'script',
        attributes: { async: '', src: 'https://cdn.example.com/w.js' },
        html: '',
      },
      { tag: 'meta', attributes: { name: 'a', content: 'b' }, html: null },
    ]);
  });

  it('preserves the script body byte for byte', () => {
    const body = `\n  var a = "</div>";\n  if (a < 1 && b > 2) { f(); }\n`;

    const [node] = parseCustomScript(`<script>${body}</script>`);

    expect(node.html).toBe(body);
  });

  it('re-serialises nested markup inside <noscript> as inner HTML', () => {
    const [node] = parseCustomScript(
      '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-X" height="0"></iframe></noscript>',
    );

    expect(node.tag).toBe('noscript');
    expect(node.html).toBe(
      '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-X" height="0"></iframe>',
    );
  });

  it('drops anything outside the root allowlist, even unvalidated', () => {
    // Simulates a row written straight into the database, bypassing the DTO.
    expect(parseCustomScript('<base href="https://evil.example/">')).toEqual(
      [],
    );
    expect(
      parseCustomScript('<script>ok()</script><object data="x"></object>'),
    ).toEqual([{ tag: 'script', attributes: {}, html: 'ok()' }]);
  });

  it('escapes quotes when re-serialising a nested attribute', () => {
    const [node] = parseCustomScript(
      '<noscript><img src="https://x.example/p.gif?a=1&b=2"></noscript>',
    );

    expect(node.html).toBe('<img src="https://x.example/p.gif?a=1&amp;b=2">');
  });

  it('returns nothing for blank input', () => {
    expect(parseCustomScript('')).toEqual([]);
    expect(parseCustomScript('   \n ')).toEqual([]);
  });
});
