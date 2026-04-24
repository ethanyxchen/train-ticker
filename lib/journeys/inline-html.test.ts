import assert from "node:assert/strict";
import test from "node:test";

import { parseInlineHtml } from "./inline-html";

test("parses inline links from alert messages", () => {
  assert.deepEqual(
    parseInlineHtml(
      'Some trains between London Kings Cross and Stevenage may still be delayed. More details can be found in <a href="https://www.nationalrail.co.uk/service-disruptions/new-barnet-20260419/">Status and Disruptions.</a>',
    ),
    [
      {
        type: "text",
        value:
          "Some trains between London Kings Cross and Stevenage may still be delayed. More details can be found in ",
      },
      {
        type: "link",
        href: "https://www.nationalrail.co.uk/service-disruptions/new-barnet-20260419/",
        label: "Status and Disruptions.",
      },
    ],
  );
});

test("falls back to plain text for unsafe links", () => {
  assert.deepEqual(
    parseInlineHtml('<a href="javascript:alert(1)">Status and Disruptions.</a>'),
    [
      {
        type: "text",
        value: "Status and Disruptions.",
      },
    ],
  );
});

test("parses inline links that span multiple lines", () => {
  assert.deepEqual(
    parseInlineHtml(
      `<a href="https://www.nationalrail.co.uk/service-disruptions/new-barnet-20260419/">
        Status and
        Disruptions.
      </a>`,
    ),
    [
      {
        type: "link",
        href: "https://www.nationalrail.co.uk/service-disruptions/new-barnet-20260419/",
        label: "Status and Disruptions.",
      },
    ],
  );
});
