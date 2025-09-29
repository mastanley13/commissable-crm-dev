const fs = require('fs');
const { parse } = require('@typescript-eslint/typescript-estree');
const text = fs.readFileSync('components/list-header.tsx', 'utf8');
try {
  parse(text, {
    jsx: true,
    loc: true,
    range: true,
    tokens: false,
    comment: false,
    filePath: 'components/list-header.tsx'
  });
  console.log('OK');
} catch (err) {
  console.error('Parse error:', err.message, err.loc);
}
