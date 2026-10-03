/**
 * Descriptions are Markdown (Rustdoc comments, docstrings) and the form shows them as plain
 * text in a hint. This is the conversion.
 */

/** Text and a URL: `[text](url)` shows as `text`. */
const LINK = /\[([^\]]+)\]\([^)]*\)/g;
/** Rustdoc intra-doc link: ``[`Foo::bar`]`` shows as `Foo::bar`. */
const CODE_LINK = /\[(`+)([^`]+)\1\]/g;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const CODE = /(`+)([^`]+?)\1/g;
const BOLD = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g;
/** `*em*`; a lone `*` between spaces (a product) is not emphasis. */
const STAR = /(?<![\\*])\*(?=\S)([^*]+?)(?<=\S)\*(?!\*)/g;
/** `_em_`, but never inside a word: `snake_case_name` is not emphasis. */
const UNDERSCORE = /(?<![\w\\])_(?=\S)([^_]+?)(?<=\S)_(?!\w)/g;
const ESCAPE = /\\([\\`*_{}[\]()#+\-.!|<>~])/g;

/**
 * The first paragraph of a Markdown description as plain text, for a one-line hint.
 *
 * Strips emphasis, inline code, links (text kept, URL dropped), Rustdoc intra-doc links and
 * backslash escapes, and joins the paragraph's lines with spaces. `snake_case` and a lone
 * `*` are left alone. Later paragraphs — a Rustdoc `# Example` section, say — are dropped.
 *
 * @param description - A schema `description`, or nothing.
 * @returns Plain text; `""` for no description.
 */
export function firstParagraph(description: string | null | undefined): string {
  if (!description) return "";
  const [paragraph = ""] = description.trim().split(/\n[ \t]*\n/);
  return paragraph
    .replaceAll(/\s*\n\s*/g, " ")
    .replaceAll(CODE_LINK, "$2")
    .replaceAll(LINK, "$1")
    .replaceAll(AUTOLINK, "$1")
    .replaceAll(CODE, "$2")
    .replaceAll(BOLD, "$2")
    .replaceAll(STAR, "$1")
    .replaceAll(UNDERSCORE, "$1")
    .replaceAll(ESCAPE, "$1")
    .replaceAll(/\s+/g, " ")
    .trim();
}
