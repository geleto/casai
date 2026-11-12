// Reader labels only. The reference always retains the complete TypeScript type.
import { typeReference } from './type-reference.js';
// Split unions at the outer level; unions inside a callback's return type belong
// to that callback, even when the callback itself is not parenthesized.
function unionMembers(type, separator = '|') {
  const members = [];
  const stack = [];
  let start = 0, quote = null, returns = false;
  for (let index = 0; index < type.length; index++) {
    const char = type[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
      continue;
    }
    if ('\'"`'.includes(char)) { quote = char; continue; }
    if (char === '=' && type[index + 1] === '>') {
      if (!stack.length) returns = true;
      index++;
      continue;
    }
    // An unparenthesized conditional also owns the union in its final branch.
    if (char === '?' && !stack.length) returns = true;
    if ('([{<'.includes(char)) stack.push(char);
    else if (")]}>".includes(char)) stack.pop();
    else if (char === separator && !stack.length && !returns) {
      members.push(type.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(type.slice(start).trim());
  return members;
}

function readableType(type, optional) {
  const expanded = unionMembers(type).flatMap(member => {
    const alias = member.match(/^(readonly )?([\w$]+)(\[\])?$/);
    const display = alias && typeReference[alias[2]]?.display;
    if (!display) return [member];
    return alias[3] ? [`${alias[1] ?? ''}(${display})[]`] : unionMembers(display);
  });
  const members = [...new Set(expanded)].filter(member => !optional || member !== 'undefined');
  const simplified = members.filter(member => {
    const intersection = member.match(/^\(([^()]+)\)$/)?.[1];
    if (!intersection) return true;
    const terms = unionMembers(intersection, '&');
    // A | B | (A & B) accepts exactly the same values as A | B.
    return terms.length < 2 || !terms.some(term => members.includes(term));
  });
  // An undefined-only value is meaningful, even for an optional field.
  return simplified.length ? simplified.join(' | ') : type;
}

// Optional markers and redundant union terms do not hide contract information.
export function isTypeAbbreviated(type, displayType, optional = false) {
  return readableType(type, optional) !== displayType;
}

function formatType(type, { optional = false, alternative } = {}) {
  const readable = readableType(type, optional);
  if (readable.length <= 150) return readable;
  if (alternative) {
    const native = readableType(alternative, optional);
    if (native.length <= 150) return native;
  }
  // Keep outer alternatives (including null) when abbreviating a complex type.
  // The ellipsis explicitly signals that the exact signature is in the details.
  return unionMembers(readable).map(member => {
    if (member.length <= 100) return member;
    const alias = member.match(/^([\w.$]+)<[\s\S]+>((?:\[\])*)$/);
    if (alias) return `${alias[1]}<…>${alias[2]}`;
    if (member.includes('=>')) return '(...arguments) => …';
    if (member.startsWith('{')) return '{ … }';
    return `${member.slice(0, 90)}…`;
  }).join(' | ');
}

// The catalog has a fixed set of types, reused across properties and selections.
// Format each combination once instead of parsing long SDK types on every click.
const labels = [new Map(), new Map()];
export function compactType(type, options = {}) {
  const cache = labels[options.optional ? 1 : 0];
  if (!cache.has(type)) cache.set(type, new Map());
  const alternatives = cache.get(type);
  const key = options.alternative ?? null;
  if (!alternatives.has(key)) alternatives.set(key, formatType(type, options));
  return alternatives.get(key);
}
