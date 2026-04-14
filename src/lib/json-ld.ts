/**
 * Safely serialize an object for embedding inside a <script type="application/ld+json"> tag
 * via dangerouslySetInnerHTML.
 *
 * The raw `JSON.stringify` output does NOT escape `<`, `>`, or `&`, which means a value
 * containing `</script>` (or a unicode line separator) can break out of the script block
 * and enable XSS. This is a known browser gotcha. The fix is to escape those characters
 * inside the JSON string before handing it to the DOM.
 *
 * References:
 *   https://redux.js.org/usage/server-rendering#security-considerations
 *   https://github.com/yahoo/serialize-javascript
 *
 * Use this for ALL dangerouslySetInnerHTML JSON-LD blocks, even when the data looks
 * trusted today. Briefing content is pipeline-generated from news sources, so the
 * string space is wider than it looks.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
